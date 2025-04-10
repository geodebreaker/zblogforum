require('dotenv').config();

const DEV = !process.env.AWS;

process.on('uncaughtException', e => console.error(e));

const SQLCONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'zbf',
  port: 3306
};
const conn = require('mysql2').createConnection(SQLCONFIG);
conn.connect(e => {
  if (e)
    return console.error('Error connecting to the database:', e);
  console.log('Connected to MySQL');
  setInterval(fetchDB, 300e3);
  fetchDB();
});
const URL = require('url').URL;
const getfile = require('fs').readFileSync;
const extToMIME = {
  html: 'text/html',
  txt: 'text/plain',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ttf: 'font/ttf',
  zip: 'application/zip',
};

function insertArray(a, i, ...x) {
  return [...a.slice(0, i), ...x, ...a.slice(i)];
}

function combineObj(a, b) {
  return Object.fromEntries(Object.entries(a).concat(Object.entries(b)));
}

function deletePost(p) {
  POSTS.splice(POSTS.findIndex(x => x.id == p), 1);
  Object.entries(REPLS).filter(x => x[1].post == p).map(x => delete REPLS[x[0]]);
  var sql = 'DELETE FROM repls WHERE post=?';
  return new Promise(y => conn.query(sql, [p], (err) => {
    if (err) {
      return y(false);
    }
    sql = 'DELETE FROM posts WHERE id=?';
    return new Promise(y => conn.query(sql, [p], (err) => {
      if (err) {
        return y(false);
      }
      console.log('Post id "' + p + '" was deleted.');
      y(true);
    }));
  }));
}

function deleteRepl(r) {
  var p = POSTS.find(x => x.id == REPLS[r].post);
  p.replies.splice(p.replies.findIndex(x => x == r), 1);
  delete REPLS[r];
  var sql = 'DELETE FROM repls WHERE id=?';
  return new Promise(y => conn.query(sql, [r], (err) => {
    if (err) {
      return y(false);
    }
    y(true);
  }));
}

function createPost(p) {
  POSTS.push(p);
  USERS[p.user].since = p.time;
  const sql = 'INSERT INTO posts (user, id, data, time, name, interact) VALUES (?, ?, ?, ?, ?, ?)';
  return new Promise((y, n) => conn.query(sql, [p.user, p.id, p.data, p.time, p.name, p.interact], (err) => {
    if (err) {
      console.log(err);
      return y(false);
    }
    const sql = 'UPDATE users SET since=? WHERE un=?';
    conn.query(sql, [p.time, p.user], (err) => {
      if (err) {
        console.log(err);
        return y(false);
      }
      console.log('Post "' + p.name + '" from "' + p.user + '" was created.');
      y(true);
    });
  }));
}

function createRepl(p) {
  REPLS[p.id] = p;
  var post = POSTS.find(y => y.id == p.post);
  post.replies.push(p.id);
  post.interact = Date.now();
  USERS[p.user].since = p.time;
  const sql = 'INSERT INTO repls (user, id, data, time, post) VALUES (?, ?, ?, ?, ?)';
  return new Promise(y => conn.query(sql, [p.user, p.id, p.data, p.time, p.post], (err) => {
    if (err) {
      console.log(err);
      return y(false);
    }
    const sql = 'UPDATE posts SET interact=? WHERE id=?';
    conn.query(sql, [post.interact, p.post], (err) => {
      if (err) {
        console.log(err);
        return y(false);
      }
      const sql = 'UPDATE users SET since=? WHERE un=?';
      conn.query(sql, [p.time, p.user], (err) => {
        if (err) {
          console.log(err);
          return y(false);
        }
        console.log('Reply to post "' + post.name + '" from "' + p.user + '" was created.');
        y(true);
      });
    });
  }));
}

function search(q) {
  var x = POSTS.map(x => [(0 + x.name.includes(q) + x.data.includes(q) + x.user.includes(q)) * 5, x]);
  x = x.concat(Object.values(REPLS).filter(x => 0 + x.data.includes(q) + x.user.includes(q) > 0)
    .map(x => [1, POSTS.find(y => y.id == x.post)]));
  x = x
    .map((y, i) => x.findIndex(x => x[1] == y[1]) == i ? (x.find(z => z[1] == y[1])[0] += y[0], y) : y)
    .filter(x => x[0] != 0)
    .sort((a, b) => b[0] - a[0])
    .filter((y, i, a) => a.findIndex(x => x[1] == y[1]) == i)
    .map(x => x[1]);
  return x.map(({ data, name, id, user }) => ({ data, name, id, user }));
}

function editUser(user, bio, pfp) {
  USERS[user].bio = bio;
  USERS[user].pfp = pfp;
  const sql = 'UPDATE users SET bio=?, pfp=? WHERE un=?';
  return new Promise((y, n) => conn.query(sql, [bio, pfp, user], (err) => {
    if (err) {
      console.log(err);
      return y(false);
    }
    console.log('User "' + user + '" updated profile.');
    y(true);
  }));
}

function fetchDB() {
  console.log('Fetch and Keepalive --- ' + new Date().getMinutes());
  var sql = 'SELECT * FROM users';
  try {
    conn.query(sql, (err, res) => {
      if (err)
        return;
      USERS = Object.fromEntries(res.map(x => [x.un,
      { un: x.un, pw: x.pw, id: x.id, perm: x.perm, bio: x.bio, pfp: x.pfp, since: x.since }]));
      sql = 'SELECT * FROM posts';
      conn.query(sql, (err, res) => {
        if (err)
          return;
        POSTS = res.map(x => (
          { user: x.user, id: x.id, data: x.data, time: x.time, name: x.name, interact: x.interact, replies: [] }));
        sql = 'SELECT * FROM repls';
        conn.query(sql, (err, res) => {
          if (err)
            return;
          REPLS = Object.fromEntries(res.map(x => [x.id,
          { id: x.id, user: x.user, post: x.post, data: x.data, time: x.time }]));
          res.map(x => POSTS.find(y => y.id == x.post).replies.push(x.id));
        });
      });
    });
  } catch (e) {
    conn.connect();
  }
}

function mksutk(ttl, un = "", amt = 1) {
  var sutks = new Array(amt).fill(0).map(_ => createId('sutk', 8));
  const sql = 'INSERT INTO sutks (tk, ttl, un) VALUES (?)' + ', (?)'.repeat(amt - 1);
  return new Promise(y => conn.query(sql, sutks.map(sutk => [sutk, Date.now() + (ttl * 86400e3), un]), (err) => {
    if (err) {
      console.log(err);
      return y(false);
    }
    sutks.map(sutk => console.log('Made sign up token ("' + sutk + '"), for username "' + un + '", for ' + ttl + ' days'));
    y(sutks);
  }));
}

// function updateUser() {

// }

function addUserIfSignup(tk, un, pw) {
  const sql = 'DELETE FROM sutks WHERE tk=? AND ttl>? AND (un="" OR un=?)';
  return new Promise(y => conn.query(sql, [tk, Date.now(), un], (err, res) => {
    if (err)
      return y(false);
    const sql = 'INSERT INTO users (un, pw, bio, pfp) VALUES (?, ?, "Nothing here yet...", "https://' + process.env.SITE + '/src/default.png")';
    if (res.affectedRows > 0)
      conn.query(sql, [un, pw], (err, res) => {
        if (err)
          return y(false);
        USERS[un] = { un, pw, id: res.insertId, perm: 0, bio: 'Nothing here yet...', pfp: 'https://' + process.env.SITE + '/src/default.png' };
        console.log('New user created ("' + un + '") with code "' + tk + '"');
        if (process.env.WEBHOOK)
          fetch(process.env.WEBHOOK, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: 'New user created (`' + un + '`) with code `' + tk + '`' })
          });
        y(true);
      });
    else
      y(false);
  }));
}

require('http').createServer(async (req, res) => {
  var body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(y => req.on('end', y));
  var authrt = ((req.headers.cookie ?? '').match(/(?<=AUTH_TOKEN=)[a-zA-Z0-9_-]{16}/g) ?? [])[0];
  var auth = AUTH[authrt];
  if (req.method == 'GET')
    var params = Object.fromEntries(new URL(req.url, 'http://a/').searchParams.entries());
  else if (req.method == 'POST')
    var params = JSON.parse(body);
  var url = req.url.replace(/^\//, '').replaceAll('//', '/').replace(/\?.+$/i, '').split('/');
  var type = url.length == 1 ? 0 : url.shift();
  if (!type == 0) {
    if (type == 'src')
      type = 1;
    else if (type == 'api')
      type = 2;
    else if (type == 'pfp')
      type = 3;
    else {
      url.unshift(type);
      type = 0;
    }
  }
  url = url.join('/');
  if (type == 0) {
    console.log(auth ? auth[0] + ':' : '', 'MAIN:', url);
    var file = getfile('./site/index.html').toString();
    var tags;
    var m = url.match(/(?<=@.+\/)p:..../);
    if (m) var mp = POSTS.find(x => x.id == m[0]);
    if (m && mp) {
      tags = {
        title: mp.name + ' - @' + mp.user,
        description: mp.data.replace(/{.*?}/g, '').slice(0, 150),
        image: '/pfp/' + m[0]
      }
    } else {
      m = url.match(/(?<=@).+/);
      if (m && USERS[m]) tags = {
        title: '@' + m[0] + ' on ZBlogForums.',
        description: USERS[m].bio.replace(/{.*?}/g, ''),
        image: '/pfp/' + m[0]
      };
    }
    file = file.replace('<!-- INSERT TAGS -->',
      Object.entries(tags ?? ogtags).map(x =>
        `<meta property="og:${x[0]}" content="${x[1].replace(/"|\\|\n/g, '')}">`).join('\n'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(file);
  } else if (type == 1) {
    src(res, url, auth)
  } else if (type == 2) {
    api(res, url, params, auth, authrt);
  } else if (type == 3) {
    if (USERS[url]) {
      res.writeHead(302, { 'Location': USERS[url].pfp });
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  } else {
    console.log(auth ? auth[0] + ':' : '', 'NCF 500:', url);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
}).listen(process.env.PORT, () => console.log('Server listening'));

function src(res, url, auth) {
  try {
    var file = getfile('./site/src/' + url);
    if (DEV && url == 'sw.js')
      file = file.toString().replace('DEV = false', 'DEV = true');
    console.log(auth ? auth[0] + ':' : '', 'SRC 200:', url);
    res.writeHead(200, { 'Content-Type': extToMIME[url.match(/(?<=\.)[a-z]{2,4}$/i)] ?? 'text/html' });
    res.end(file);
  } catch (e) {
    console.log(auth ? auth[0] + ':' : '', 'SRC 404:', url);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

async function api(res, url, params, auth, authrt) {
  const ret = x => {
    var status = x != undefined ? 200 : 500;
    console.log(auth ? auth[0] + ':' : '', 'API ' + status + ':', url, url == 'content' ? params.q : '');
    res.writeHead(status, { 'Content-Type': x != undefined ? 'application/json' : 'text/plain' });
    res.end(x != undefined ? JSON.stringify(x) : '500 Internal Server Error');
  };
  if (
    (url == 'content' && params.q.startsWith('/signout')) ||
    (!(url == 'content' && params.q.startsWith('/signin')) &&
      url != 'signin' &&
      (!auth || auth[1] < Date.now()))) {
    if (auth)
      delete AUTH[authrt];
    res.setHeader('Set-Cookie', 'AUTH_TOKEN=; Max-Age=0; Path=/');
    return ret({ type: 'signin', title: 'Redirecting...' });
  }
  var un = (auth ?? [])[0];
  switch (url) {
    case 'restart':
      if (USERS[un].perm > 3)
        process.exit();
      else
        ret({ 'fail': 'not enough permission' });
      break;
    case 'gensutk':
      if (!params.ttl)
        return ret({ 'fail': 'ttl not specified' });
      if (USERS[un].perm > 3)
        return ret(await mksutk(params.ttl, params.un, params.amt));
      else
        ret({ 'fail': 'not enough permission' });
      break;
    case 'content':
      if (params.q == undefined)
        return ret();
      var cont = content(params.q, un);
      cont.un = un;
      if (un)
        cont.notif = 2;
      cont.perm = un ? USERS[un].perm : 0;
      ret(cont);
      break;
    case 'reply':
      if (USERS[un].perm < 0)
        return ret({ fail: 'banned. to appeal send an email to [yourproblem@' + process.env.SITE + ']' });
      if (!params.p || !params.d)
        return ret();
      var post = POSTS.find(x => params.p == x.user + '/' + x.id);
      if (!post)
        return ret();
      var newpost = { id: createId('r'), user: un, data: params.d, time: Date.now(), post: post.id };
      createRepl(newpost);
      ret(newpost);
      break;
    case 'create':
      if (USERS[un].perm < 0)
        return ret({ fail: 'banned. to appeal send an email to [yourproblem@' + process.env.SITE + ']' });
      if (!params.d || !params.n)
        return ret();
      var newpost = { id: createId('p'), user: un, name: params.n, replies: [], data: params.d, time: Date.now() };
      newpost.interact = newpost.time;
      createPost(newpost);
      ret({ url: '/@' + newpost.user + '/' + newpost.id });
      break;
    case 'signin':
      if (auth)
        delete AUTH[authrt];
      if (params.tk && !(await addUserIfSignup(params.tk, params.un, params.pw)))
        return ret({ fail: 'Invalid token' });
      if (!USERS[params.un])
        return ret({ fail: 'User does not exist.' });
      if (USERS[params.un].perm < -1)
        return ret({ fail: 'banned. to appeal send an email to [yourproblem@' + process.env.SITE + ']' });
      if (USERS[params.un].pw != params.pw)
        return ret({ fail: 'Invalid password.' });
      var atk = createId(null, 16);
      AUTH[atk] = [params.un, Date.now() + (86400e3)];
      res.setHeader('Set-Cookie', 'AUTH_TOKEN=' + atk + '; Max-Age=86400; SameSite=Strict; Secure; HttpOnly; Path=/');
      ret({});
      break;
    case 'log':
      if (USERS[un].perm > 3)
        try {
          ret(getfile('/var/log/web.stdout.log').toString().slice(-10000, -1));
        } catch (e) {
          ret({ fail: 'failed to get logs' });
        }
      else
        ret({ fail: 'not enough permission' });
      break;
    case 'edituser':
      if (params.u && USERS[un].perm <= 3)
        return ret({ fail: 'not enough permission' });
      if (!params.b || !params.p)
        return ret();
      editUser(params.u ?? un, params.b, params.p)
      ret({});
      break;
    case 'delete':
      var p = POSTS.find(x => x.id == params.p);
      if (!p)
        return ret();
      if (un != p.user && USERS[un].perm <= 2)
        return ret({ fail: 'not enough permission' });
      return ret(deletePost(params.p));
    case 'deleterepl':
      if (!REPLS[params.p])
        return ret();
      if (!REPLS[params.p].user != un && USERS[un].perm <= 2)
        return ret({ fail: 'not enough permission' });
      return ret(deleteRepl(params.p));
    case 'clearnew':
      USERS[un].since = Date.now();
      const sql = 'UPDATE users SET since=? WHERE un=?';
      conn.query(sql, [USERS[un].since, un], (err) => {
        if (err) {
          console.log(err);
          return ret(false);
        }
        ret(true);
      });
      break;
    case 'search':
      return ret(search(params.q));
    default:
      ret();
      break;
  }
}

function content(ourl, un) {
  var url = ourl.split('/');
  if (url.length > 1) url.shift();
  var type = url.shift() ?? '';
  if (type.includes('?')) {
    var type = type.split(/\?/);
    url[0] = '?' + type[1] + url[0];
    type = type[0];
  }
  var user = null;
  if (type.startsWith('@')) {
    user = type.replace('@', '');
    if (url.length == 0)
      type = 'user';
    else
      type = 'post';
  }
  url = url.join('/');
  switch (type) {
    case '':
      var out = {
        type: 'home', title: 'ZBlogForums', since: USERS[un].since, posts: POSTS
          .map(({ user, id, name, time, interact }) => ({ user, id, name, time, interact, perm: (USERS[user] ?? {}).perm }))
          .sort((a, b) => b.interact - a.interact),
        items: [
          ["Rules", "/rules"],
          ["Guide", "/guide"],
          ["Checklist", "/checklist"],
          ["\n", ""],
          ["Sign Out", "/signout"],
        ]
      };
      if (USERS[un].perm > 3)
        out.items = insertArray(out.items, 3, ["\n", ""], ["Admin panel", "/apanel"])
      return out;
    case 'me':
      user = un;
    case 'user':
      if (!USERS[user])
        return { type: 'html', title: 'User not found', html: 'User not found<br><br><a onclick="go(\'/\')" href="#">Homepage</a>' };
      var posts = POSTS.filter(x => x.user == user)
        .map(({ id, name, time, interact }) => ({ id, name, time, interact })).sort((a, b) => b.interact - a.interact);
      var repls = Object.entries(REPLS).map(x => x[1])
        .filter(x => x.user == user).map(({ post, data, time }) =>
          ({ user: POSTS.find(x => x.id == post).user, data, name: POSTS.find(x => x.id == post).name, id: post, time }))
        .sort((a, b) => b.time - a.time);
      return {
        type: 'user', title: '@' + user + ' - ZBlogForums', user, posts, repls,
        bio: USERS[user].bio, pfp: USERS[user].pfp, uperm: USERS[user].perm
      };
    case 'post':
      if (!USERS[user])
        return { type: 'html', title: 'User not found', html: 'User not found<br><br><a onclick="go(\'/\')">Homepage</a>' };
      var post = structuredClone(POSTS.find(x => x.id == url && x.user == user));
      if (post) {
        post.replies = post.replies.map(x => combineObj(REPLS[x], { perm: (USERS[REPLS[x].user] ?? {}).perm }));
        post.perm = (USERS[user] ?? {}).perm;
        return { type: 'post', post, title: post.name + ' - ZBlogForums' };
      } else return { type: 'html', title: 'Post not found', html: 'Post not found<br><br><a onclick="go(\'/\')">Homepage</a>' };
    case 'apanel':
      if (USERS[un].perm < 3)
        return { fail: 'not enough permission', type: "html", html: "not enough permission", title: 'Error' };
    case 'rules':
    case 'begin':
    case 'guide':
    case 'create':
    case 'signin':
    case 'search':
    case 'checklist':
      try {
        return { type: 'html', title: type + ' - ZBlogForums', html: getfile('./site/src/' + type + '.html').toString() };
      } catch (e) {
        return {
          fail: 'Failed to get ' + type + ' page', type: 'html',
          title: type + ' - ZBlogForums', html: 'Failed to get ' + type + ' page.'
        };
      }
    default:
      return { type: 'html', title: 'Page not found', html: '404 Not Found<br><br><a onclick="go(\'/\')">Homepage</a>' };
  }
}

var POSTS = [
  // { user: createId('u'), id: createId('p'), name: 'help oh god the darkness is coming (1)', data: 'g', replies: [] },
  // {
  //   user: createId('u'), id: createId('p'), name: 'patooie', data: 'patooie', replies: [{
  //     id: createId('r'), user: createId('u'), data: 'patooie',
  //   }]
  // },
  // { user: createId('u'), id: createId('p'), name: 'ralseri', data: 'why.', replies: [] },
];

var REPLS = [];

function createId(y, l = 4, x = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZCVNM1234567890-_') {
  return (y ? y + ':' : '') + new Array(l).fill(0).map(() => x[Math.floor(Math.random() * x.length)]).join('')
}

const AUTH = {};

var USERS = {};

var ogtags = {
  title: 'ZBlogForums',
  description: 'A mix between a blog and a forum',
  image: '/src/logo.png',
  'image:type': 'image/png'
};
