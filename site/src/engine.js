$ = (x, y = document) => y.querySelector(x);
$$ = (x, y = document) => y.querySelectorAll(x);
var fetchonfocus = false;
var pauseupdate = false;
var un = '';

function init() {
  window.onerror = alert;
  window.onfocus = () => { if (fetchonfocus) go() };
  window.onpopstate = e => new Promise(y => y(go(null, e.state)));
  window.onkeydown = e => {
    if (e.target.tagName == 'INPUT' || e.target.tagName == 'TEXTAREA')
      pauseupdate = true;
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
  pauseupdate = false;
  if (loc && !stat)
    history.pushState({}, '', loc);
  if (!(stat && stat.ttl >= Date.now() - 60e3)) {
    var c = await net('content', { q: loc ?? location.pathname + location.search });
    history.replaceState({ ttl: Date.now(), stat: c }, '', location.pathname + location.search);
  } else {
    c = stat.stat;
  }
  $('#content').innerHTML = "";
  $('title').innerText = c.title;
  un = $('#untag').innerText = c.un ?? '';
  $('#n-count').innerText = c.notif;
  $('#n-count').style.display = c.notif ? 'inline-block' : 'none';
  switch (c.type) {
    case 'signin':
      setTimeout(go, 10, '/signin?q=' + encodeURI(location.pathname == '/signout' ? '/' : location.pathname));
      break;
    case 'html':
      $('#content').innerHTML = c.html.replace(/(?<!\\)%{(.{2,12}):({.*?})}%/gs,
        (_, y, z) => module(y, JSON.parse(z)));
      pauseupdate = true;
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

function mkp_home(x) {
  $('#content').innerHTML = `<div class="right"><h3>ZBlogForums</h3>by evrtdg<hr>${x.items.map(x =>
    x[0] == '\n' ? '<hr>' : '<a href="' + x[1] + '">' + x[0] + '</a>' + '<br>').join(' ')}</div>`;
  x.posts.map(y => {
    $('#content').append(
      module('postslot', {
        site: '/@' + y.user + '/' + y.id,
        name: escapeHTML(y.name),
        user: y.user,
      }, true)
    );
  })
}

function mkp_user(x) {
  $('#content').innerHTML = `
    <h3><img class="pfp" src="/pfp/${x.user}">@${x.user}</h3>
    <div>${escapeHTML(x.bio)}</div>
    <hr>
    <h3>Posts:</h3>` +
    x.posts.map(y =>
      module('postslot', {
        site: '/@' + y.user + '/' + y.id,
        name: escapeHTML(y.name),
        user: ''
      })
    ).join('') + '<h3>Replies:</h3>' +
    x.repls.map(y =>
      module('postslot', {
        site: '/@' + y.user + '/' + y.id,
        name: escapeHTML(y.name),
        desc: escapeHTML(y.data.split('\n')[0].slice(0, 30)),
        user: y.user
      })
    ).join('')
}

const ADDREPLBTN =
  '<div id="addrepl" class="button" onclick="switchrepl(false, \'%\');">Add Reply</div>';

function mkp_post(post) {
  $('#content').innerHTML = module('post', {
    user: post.user,
    name: escapeHTML(post.name),
    post: escapeHTML(post.data),
    time: fmtDate(post.time),
  }) + ADDREPLBTN.replace('%', post.user + '/' + post.id);
  post.replies.map(r => mkrepl(r));
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

function mkrepl(r) {
  $('#content').innerHTML += module('post', {
    user: r.user,
    post: escapeHTML(r.data),
    time: fmtDate(r.time),
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

async function net(url, dat, err) {
  var c = await fetch('/api/' + url + (dat ? '?' + Object.entries(dat).map(x => x[0] + '=' + encodeURI(x[1])).join('&') : '')).then(
    r => r.ok ? r.json() : { fail: ['Server provided response: ', r.text()] },
    e => ({ fail: 'Error occured: ' + e }));
  if (c.fail && err)
    err('Failed to fetch page content. Please reload.',
      (c.fail instanceof Array ? c.fail[0] + await c.fail[1] : c.fail));
  else if (c.fail)
    throw c.fail instanceof Array ? c.fail[0] + await c.fail[1] : c.fail;
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
  net('signin', { un, pw, tk }, false).then(
    () => {
      go(decodeURI(location.search.split('=')[1] || '/'));
      $('#silog').innerText = '';
    }, e => {
      $('#silog').innerText = e;
    }
  )
}

document.addEventListener('DOMContentLoaded', init);

function fmtDate(ms) {
  var x = new Date(parseInt(ms));
  var y = x.getHours() % 12;
  var z = x.getMinutes().toString();
  return `${x.getMonth() + 1}/${x.getDate()}/${x.getFullYear()} ` +
    `${y == 0 ? 12 : y}:${z.length == 1 ? '0' + z : z} ${x.getHours() > 11 ? 'PM' : 'AM'}`;
}

// JS is a dumb piece of fucking shit godamnit
function isString(x) {
  try {
    return Object.getPrototypeOf(x).isPrototypeOf(new String(""));
  } catch (e) {
    return true;
  }
}