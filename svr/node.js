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

require('http').createServer((req, res) => {
  var params = Object.fromEntries(new URL(req.url, 'http://a/').searchParams.entries());
  var url = req.url.replace(/^\//, '').replaceAll('//', '/').replace(/\?.+$/i, '').split('/');
  var type = url.length == 1 ? 0 : url.shift();
  if (!type == 0) {
    if (type == 'src')
      type = 1;
    else if (type == 'api')
      type = 2;
    else
      type = 0;
  }
  url = url.join('/');
  if (type == 0) {
    console.log('MAIN:', url);
    var file = getfile('./site/index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(file);
  } else if (type == 1) {
    src(res, url)
  } else if (type == 2) {
    api(res, url, params)
  } else {
    console.log('NCF 500:', url);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error\n\n-- ZBF --');
  }
}).listen(8080);

function src(res, url) {
  try {
    var file = getfile('./site/src/' + url);
    console.log('SRC 200:', url);
    res.writeHead(200, { 'Content-Type': extToMIME[url.match(/(?<=\.)[a-z]{2,4}$/i)] ?? 'text/html' });
    res.end(file);
  } catch (e) {
    console.log('SRC 404:', url);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found\n\n-- ZBF --');
  }
}

function api(res, url, params) {
  const ret = x => {
    var status = x ? 200 : 500;
    console.log('API ' + status + ':', url);
    res.writeHead(status, { 'Content-Type': x ? 'application/json' : 'text/plain' });
    res.end(x ? JSON.stringify(x) : '500 Internal Server Error\n\n-- ZBF --');
  };
  switch (url) {
    case 'content':
      if (params.q == undefined)
        return ret();
      ret(content(params.q))
      break;
    case 'reply':
      if (!params.p || !params.d)
        return ret();
      var post = POSTS.find(x => params.p == x.user + '/' + x.id);
      if(!post)
        return ret();
      var newpost = { id: createId('r'), user: createId('u'), data: params.d };
      post.replies.push(newpost);
      ret(newpost);
      break;
    default:
      ret();
      break;
  }
}

function content(ourl) {
  var url = ourl.split('/');
  if (url.length > 1) url.shift();
  var type = url.shift() ?? '';
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
      return { type: 'home', title: 'ZBlogForums', posts: POSTS.map(({ user, id, name }) => ({ user, id, name })), 
        items: { "Rules": "/rules" } };
    case 'user':
      var posts = POSTS.filter(x => x.user == user).map(({ user, id, name }) => ({ user, id, name }));
      return { type: 'user', title: '@' + user + ' - ZBlogForums', user, posts };
    case 'post':
      var post = POSTS.find(x => x.id == url && x.user == user);
      if (post)
        return { type: 'post', post, title: post.name + ' - ZBlogForums' };
      else
        return { type: 'html', title: 'Post not found', html: 'Post not found<br><br><a onclick="go(\'/\')" href="">Homepage</a>' };
    case 'rules':
      try {
        return { type: 'html', title: 'Rules - ZBlogForums', html: getfile('./site/src/rules.html').toString() };
      } catch (e) {
        return { type: 'html', title: 'Rules - ZBlogForums', html: 'Failed to get rules.' };
      }
    default:
      return { type: 'html', title: 'Page not found', html: '404 Not Found<br><br><a onclick="go(\'/\')" href="">Homepage</a>' };
  }
}

const POSTS = [
  { user: createId('u'), id: createId('p'), name: 'help oh god the darkness is coming (1)', data: 'g', replies: [] },
  {
    user: createId('u'), id: createId('p'), name: 'patooie', data: 'patooie', replies: [{
      id: createId('r'), user: createId('u'), data: 'patooie',
    }]
  },
  { user: createId('u'), id: createId('p'), name: 'ralseri', data: 'why.', replies: [] },
];

function createId(y, l = 4, x = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZCVNM1234567890-_') {
  return y + ':' + new Array(l).fill(0).map(() => x[Math.floor(Math.random() * x.length)]).join('')
}