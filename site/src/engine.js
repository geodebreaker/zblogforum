$ = (x, y = document) => y.querySelector(x);
$$ = (x, y = document) => y.querySelectorAll(x);
var fetchonfocus = false;
var pauseupdate = false;
var un = '';
var perm;

var raw = {};

function init() {
  window.onerror = alert;
  window.onfocus = () => { if (fetchonfocus && !pauseupdate) go(), fetchonfocus = false };
  window.onpopstate = e => new Promise(y => y(go(null, e.state)));
  window.onkeydown = e => {
    if (e.target.tagName == 'INPUT' || e.target.tagName == 'TEXTAREA')
      pauseupdate = true;
    if ((e.key == '`' || e.key == '~' || e.key == '/' || e.key == '?') && e.altKey && $('.mkpost'))
      $('.mkpost').click();
  }
  window.addEventListener('click', e => {
    if (e.target.tagName == 'A') {
      e.preventDefault();
      go(e.target.getAttribute('href'));
    }
  });
  $('#h-opts').onclick = e => {
    if (e.target.classList.contains('h-opt') || e.target.id == 'untag') {
      switch (e.target.id == 'untag' ? 'U' : e.target.innerText.at(-1)) {
        case 'R':
          go();
          break;
        case 'C':
          go('/create');
          break;
        case 'F':
          go('/search');
          break;
        case 'U':
          if (un) go('/@' + un);
          break;
      }
    }
  };
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('/src/sw.js')
  go();
}

async function go(loc, stat) {
  if (loc && !stat) {
    pauseupdate = false;
    history.pushState({}, '', loc);
  }
  if (!(stat && stat.ttl >= Date.now() - 60e3)) {
    var c = await net('content', { q: loc ?? location.pathname + location.search });
    history.replaceState({ ttl: Date.now(), stat: c }, '', location.pathname + location.search);
  } else {
    c = stat.stat;
  }
  $('#content').innerHTML = "";
  if (loc && !stat)
    $('#content').scrollTop = 0;
  $('title').innerText = c.title;
  un = $('#untag').innerText = c.un ?? '';
  perm = c.perm ?? 0;
  $('#n-count').innerText = c.notif;
  $('#n-count').style.display = c.notif ? 'inline-block' : 'none';
  switch (c.type) {
    case 'signin':
      setTimeout(go, 0, '/signin?q=' + encodeURI(location.pathname == '/signout' ? '/' : location.pathname));
      break;
    case 'html':
      pauseupdate = true;
      $('#content').innerHTML = c.html.replace(/(?<!\\)%{(.{2,12}):({.*?})}%/gs,
        (_, y, z) => module(y, JSON.parse(z)));
      if (location.pathname.startsWith('/signin')) {
        var x = (
          location.search.replace('?', '').split('&')
            .find(x => x.startsWith('tk=')) ?? '').replace('tk=', '');
        if (x) $('#sutk').value = x;
      }
      break;
    case 'home':
      mkp_home(c)
      break;
    case 'post':
      mkp_post(c.post);
      break;
    case 'user':
      mkp_user(c)
      break;
    default:
      err('Unknown page type.');
      break;
  }
  setTimeout(x => {
    if (location.pathname == x && !pauseupdate) {
      if (document.hasFocus())
        go();
      else
        fetchonfocus = true
    }
  }, 60e3, location.pathname);
}

function err(...e) {
  alert(e.join('\n'))
}

function module(name, inputs, nhtml) {
  var x = $('.mod.' + name).cloneNode(true);
  x.classList.remove('mod');
  var h = x.outerHTML.replace(/%([a-z]{2,12}?)%/gs, (x, y) => {
    return inputs[y] ?? x;
  }).replace(/(?<!\\)%{([a-z]{2,12}?):({.*?})}%/gs, (_, y, z) => module(y, JSON.parse(z)))
    .replace(/%\??(\!?)([a-z]{2,12}?){{(.*?)}}/gs, (_, x, y, z) => {
      return (x ? !inputs[y] : inputs[y]) ? z : '';
    });
  if (nhtml) {
    var y = document.createElement('span');
    y.innerHTML = h;
    return y.children[0];
  } else {
    return h;
  }
}

function edituser(x) {
  $('#u-bio').style.display = x ? 'block' : 'none';
  $('#edituser').style.display = x ? 'none' : 'block';
  if (x) {
    net('edituser', { b: $('#eu-bio').value, p: $('#eu-pfp').value }).then(() => go());
  }
}

function mkp_home(x) {
  $('#content').innerHTML = `<div class="right"><h3>ZBlogForums</h3>by evrtdg<hr>${x.items.map(x =>
    x[0] == '\n' ? '<hr>' : '<a href="' + x[1] + '">' + x[0] + '</a>' + '<br>').join(' ')}</div>`;
  var pu = false;
  x.posts.map((y, i) => {
    if (!pu && y.interact <= x.since) {
      pu = true;
      if (i != 0)
        $('#content').innerHTML += '<span><span id="new1" onclick="clearnew(this)">new</span><span id="new2"></span></span>';
    }
    $('#content').append(
      module('postslot', {
        site: '/@' + y.user + '/' + y.id,
        name: styleEmote(y.name),
        user: y.user,
        perm: 'xx vbma'[y.perm + 2] ?? ''
      }, true)
    );
  })
}

function clearnew(o) {
  net('clearnew').then(() => o.parentElement.remove());
}

function mkp_user(x) {
  var perm = 'xx vbma'[x.uperm + 2];
  $('#content').innerHTML = `
    <h3><img class="pfp" src="/pfp/${x.user}">@${x.user}<span class="perm p${perm}">${perm}</span></h3>
    <div id="u-bio">${styleText(x.bio)}${x.user == un ? '<span class="eduser" onclick="edituser()">E</span>' : ''}</div>
    <div id="edituser" style="display:none;">
      <textarea placeholder="bio" id="eu-bio">${escapeHTML(x.bio).replaceAll('<br>', '\n')}</textarea>
      <input id="eu-pfp" placeholder="link to pfp" value="${x.pfp}">
      <span class="button" onclick="edituser(true)">Done</span> (You may need to reload to see new pfp)
    </div>
    <hr>
    <h3>Posts:</h3>` +
    x.posts.map(y =>
      module('postslot', {
        site: '/@' + x.user + '/' + y.id,
        name: styleEmote(y.name),
        user: ''
      })
    ).join('') + '<h3>Replies:</h3>' +
    x.repls.map(y =>
      module('postslot', {
        site: '/@' + y.user + '/' + y.id,
        name: styleEmote(y.name),
        desc: escapeHTML(y.data.split('\n')[0].slice(0, 30)),
        user: ''
      })
    ).join('')
}

const ADDREPLBTN = '<div id="addrepl" class="button" onclick="switchrepl(false, \'%\');">Add Reply</div>';

function mkp_post(post) {
  raw[post.id] = post.data;
  $('#content').innerHTML = module('post', {
    user: post.user,
    name: styleEmote(post.name),
    post: styleText(post.data),
    time: fmtDate(post.time),
    perm: 'xx vbma'[post.perm + 2],
    id: post.id
  }) + ADDREPLBTN.replace('%', post.user + '/' + post.id);
  post.replies.map(r => mkrepl(r));
}

function prevpost() {
  $('.cp-prev').innerHTML = module('post', {
    user: un,
    name: styleEmote($('.cp-name').value),
    post: styleText($('.cp-cont').value),
    perm: '',
  });
}

function switchrepl(x, p) {
  if (x) {
    pauseupdate = false;
    var x = document.createElement('span');
    x.innerHTML = ADDREPLBTN.replace('%', p);
    var y = $('.createpost:not(.mod)');
    y.parentElement.insertBefore(x.children[0], y);
    y.remove();
  } else {
    pauseupdate = true;
    var y = $('#addrepl');
    var x = module('createpost', { 'reply': p }, true);
    y.parentElement.insertBefore(x, y);
    x.children[0].focus();
    y.remove();
  }
}

function reply(pid) {
  var x = $('.cp-cont').value;
  switchrepl(true, pid);
  if (x)
    net('reply', { p: pid, d: x }).then(x => mkrepl(x));
  else
    err('You need to enter text to reply.');
}

function escapeHTML(html) {
  var x = document.createElement('span');
  x.innerText = html;
  return x.innerHTML;
}

function unescapeHTML(text) {
  var x = document.createElement('span');
  x.innerHTML = text;
  return x.innerText;
}

function mkrepl(r) {
  raw[r.id] = r.data;
  $('#content').innerHTML += module('post', {
    user: r.user,
    post: styleText(r.data),
    time: fmtDate(r.time),
    perm: 'xx vbma'[r.perm + 2] ?? '',
    id: r.id,
  });
}

function mkpost() {
  var d = $('.cp-cont').value;
  var n = $('.cp-name').value;
  $('.mkpost').disabled = true;
  if (d && n)
    net('create', { d, n }).then(u => go(u.url));
  else
    err('You need to enter text to post.');
}

function postinfo(p, user) {
  $('#pinfo').innerHTML = module('pinfo', {
    raw: escapeHTML(raw[p]),
    ispost: p.startsWith('p'),
    mod: perm > 2,
    admin: perm > 3,
    id: p,
    user,
    isuser: user == un && perm <= 2,
  }, true).innerHTML;
  $('#pinfo').showPopover();
}

function search(q) {
  net('search', { q }).then(x => {
    $('#s-con').innerHTML = x.length == 0 ? 'Nothing here...' : '';
    x.map(y => $('#s-con').append(
      module('postslot', {
        site: '/@' + y.user + '/' + y.id,
        name: styleEmote(y.name),
        user: y.user,
        perm: 'xx vbma'[y.perm + 2] ?? '',
      }, true)
    ))
  });
}

function deletePost(id, ispost) {
  net('delete' + (ispost == 'true' ? '' : 'repl'), { p: id }).then(() => { if (ispost == 'true') go('/') });
  $('#pinfo').hidePopover();
}

async function net(url, dat, erra) {
  var c = await fetch('/api/' + url, //+ (dat ? '?' + Object.entries(dat).map(x => x[0] + '=' + encodeURI(x[1])).join('&') : ''),
    dat ? { headers: { 'Content-Type': 'application/json' }, method: 'post', body: JSON.stringify(dat) } : undefined).then(
      r => r.ok ? r.json() : { fail: ['Server provided response: ', r.text()] },
      e => ({ fail: 'Error occured: ' + e }));
  if (c.fail && !erra)
    err(url == 'content' ? 'Failed to fetch page content. Please reload.' : '',
      (c.fail instanceof Array ? c.fail[0] + await c.fail[1] : c.fail));
  else if (c.fail)
    throw c.fail instanceof Array ? c.fail[0] + await c.fail[1] : c.fail;
  console.log(url, dat, c);
  return c;
}

function signin() {
  $('#silog').innerText = '...';
  var un = $('#username').value.toLowerCase();
  var pw = $('#password').value;
  var tk = $('#sutk').value;
  if (un.length < 2 || un.length > 12)
    return $('#silog').innerText = 'username must be at least 2 and at most 12 chars';
  if (!(/^[a-zA-Z0-9-_]+$/.test(un)))
    return $('#silog').innerText = 'username must only have letters, numbers, - and _';
  if (pw.length < 4)
    return $('#silog').innerText = 'password must be at least 4 chars';
  // if (!([/\w/, /[a-z]/, /[A-Z]/, /[!@#$%^&*()_+{}|~`\\\][<>?,./;:'"-=]/]
  //   .map(x => x.test(pw) ? 1 : 0).reduce((a, b) => a + b) >= 3))
  //   return $('#silog').innerText = 'password must contain at least 3 of uppercase, lowercase, \n' +
  //     'numbers, and special chars';
  net('signin', { un, pw, tk }, true).then(
    () => {
      go((location.search.replace('?', '').split('&').find(x => x.startsWith('q=')) ?? '').replace('q=', '') || '/begin');
      $('#silog').innerText = '';
    }, e => {
      $('#silog').innerText = e;
    }
  )
}

function bulksutk() {
  pauseupdate = true;
  var amt = parseInt(prompt(''));
  if (amt) net('gensutk', { ttl: prompt('lasts until (days)'), un: '', amt }).then(x =>
    $('#ap-out').innerText = x.map(y => location.origin + '/signin?tk=' + y).join('\n'))
}

document.addEventListener('DOMContentLoaded', init);

function fmtDate(ms) {
  var x = new Date(parseInt(ms));
  var y = x.getHours() % 12;
  var z = x.getMinutes().toString();
  return `${x.getMonth() + 1}/${x.getDate()} ` +
    `${y == 0 ? 12 : y}:${z.length == 1 ? '0' + z : z} ${x.getHours() > 11 ? 'PM' : 'AM'} ` + x.getFullYear().toString();
}

// JS is a dumb piece of fucking shit godamnit
function isString(x) {
  try {
    return Object.getPrototypeOf(x).isPrototypeOf(new String(""));
  } catch (e) {
    return true;
  }
}
// like actually

function link(l, x, event) {
  event.preventDefault();
  var u = new URL((l.startsWith('/') ? location.origin : l.startsWith('http') ? '' : 'https://') + l);
  if (location.host == u.host)
    go(u.pathname);
  else if (confirm('Do you want to go to "' + u.href + '"?')) {
    if (x) location = u;
    else {
      var a = document.createElement('a');
      a.href = u.href;
      a.target = '_blank';
      a.click();
    }
  }
  return false;
}

function styleText(z) {
  var x = z;
  try {
    x = styleEmote(x);
  } catch (e) {
    console.error(e);
  }
  x = (x.replace(/(?<=^| )@[a-zA-Z0-9_-]{2,12}/g,
    x => `{l,/${x},${x}}`) + ' ').split('');
  var y = [['']];
  for (var c = ''; x.length > 0; c = x.shift()) {
    var a = y[y.length - 1];
    if (c == '\\') a[a.length - 1] += x.shift();
    else if (c == '{') y.push(['']);
    else if (c == ',' && y.length > 1) a.push('');
    else if (c == '}' && y.length > 1) {
      var b = y.pop();
      a = y[y.length - 1];
      try {
        a[a.length - 1] += style(b.shift(), b);
      } catch (e) {
        console.error(e);
      }
    } else a[a.length - 1] += c;
  }
  return y[0][0];
}

function style(x, y) {
  switch (x) {
    case '':
      return '</span>'.repeat(y.length + 1);
    case 'b':
    case 'i':
    case 'u':
    case 's':
    case 'g':
    case 'r':
      y.unshift(x);
      return y.map(x => 'biusgr'.split('').includes(x) ? `<span class="style ${x}">` : '').join('');
    case 'c':
    case 'h':
      return `<span class="style" style="${x == 'h' ? 'background-' : ''}color:${y[0].replaceAll(';', '')}">`;
    case 'l':
    case 'ls':
      return `<a onclick="link('${y[0]}', ${x == 'ls'}, event)" href="${y[0]}">${y[1] ?? y[0]}</a>`;
    case 'p':
      if (y[1] > 500) y[1] = 500;
      if (y[2] > 500) y[2] = 500;
      return `<img src="${y[0]}" class="img"` + (y[1] ? `width="${y[1]}" height="${y[2] ?? y[1]}"` : '') + '>';
    case 't':
      return `<details><summary>${y.shift()}</summary><span>${y.join(',')}</span></details>`;
    case 'f':
      return `<span style="font-family: ${y[0].replaceAll(';', '')}, monospace;" class="style">`;
    default:
      return '{' + x + ',' + y.join(',') + '}';
  }
}

function styleEmote(xo) {
  var x = escapeHTML(xo);
  const emo = {
    jpg: ["mood", "goober", "horror", "nohorror", "clueless", "silly", "roll", "mh", "moodenheimer", "panic", "ralsei", "mf", "cool", "hello"],
    png: ["chair"],
    gif: ["huh", "bigshot", "sad", "alarm"],
  };
  return x.replace(/(\\?)(:(.{2,14}?):)/g, (_match, bs, og, name) => {
    var type = (Object.entries(emo).find(x => x[1].includes(name)) ?? [])[0];
    if (bs || !type)
      return og;
    return `<img src="${location.origin}/src/emoji/${name}.${type}" class="emote">`;
  });
}
