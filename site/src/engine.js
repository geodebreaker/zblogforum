$ = (x, y = document) => y.querySelector(x);

function init() {
  window.onerror = alert;
  window.onpopstate = e => new Promise(y => y(go(null, e.state)));
  window.addEventListener('click', e => {
    if (e.target.tagName == 'A') {
      e.preventDefault();
      go(e.target.getAttribute('href'));
    }
  });
  $('#h-opts').onclick = e => {
    if (e.target.classList.contains('h-opt')) {
      switch (e.target.innerText) {
        case 'R':
          go();
          break;
      }
    }
  };
  go();
}

async function go(loc, stat) {
  if (loc && !stat)
    history.pushState({}, '', loc);
  if (!(stat && stat.ttl >= Date.now() - 60e3)) {
    var c = await net('content', { q: loc ?? location.pathname });
    history.replaceState({ ttl: Date.now(), stat: c }, '', location.pathname);
  } else {
    c = stat.stat;
  }
  $('#content').innerHTML = "";
  $('title').innerText = c.title;
  switch (c.type) {
    case 'html':
      $('#content').innerHTML = c.html;
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
}

function err(...e) {
  alert(e.join('\n'))
}

function module(name, inputs, nhtml) {
  var x = $('.mod.' + name).cloneNode(true);
  x.classList.remove('mod');
  var h = x.outerHTML.replace(/%([a-z]{2,8})%/g, (x, y) => {
    return inputs[y] ?? x;
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
  $('#content').innerHTML = `<div class="right"><h3>ZBlogForums</h3>by evrtdg<hr>${Object.entries(x.items).map(x =>
    '<a href="' + x[1] + '">' + x[0] + '</a>').join('<br>')}</div>`;
  x.posts.map(y => {
    $('#content').append(
      module('postslot', {
        site: '/@' + y.user + '/' + y.id,
        name: escapeHTML(y.name),
        user: module('userlink', {
          user: y.user
        })
      }, true)
    );
  })
}

function mkp_user(x) {
  $('#content').innerHTML = `<h3>@${x.user}</h3><hr>`;
  x.posts.map(y => {
    $('#content').append(
      module('postslot', {
        site: '/@' + y.user + '/' + y.id,
        name: escapeHTML(y.name),
        user: ''
      }, true)
    );
  })
}

function mkp_post(post) {
  $('#content').innerHTML = `
    ${module('userlink', { user: post.user })}
    <h3>${escapeHTML(post.name)}</h3>
    <div>${escapeHTML(post.data)}</div>
    <hr>
    <div id="addrepl" onclick="reply('${post.user}/${post.id}')">Add Reply</div>`;
  post.replies.map(r => mkrepl(r));
}

function reply(pid) {
  var x = prompt('AAAAAHHH');
  if (x)
    net('reply', { p: pid, d: x }).then(x => mkrepl(x));
}

function escapeHTML(html) {
  var x = document.createElement('span');
  x.innerText = html;
  return x.innerText;
}

function mkrepl(r) {
  $('#content').innerHTML += `
    <hr>
    ${module('userlink', { user: r.user })}
    <div>${escapeHTML(r.data)}</div>`;
}

async function net(url, dat) {
  var c = await fetch('/api/' + url + '?' + Object.entries(dat).map(x => x[0] + '=' + encodeURI(x[1])).join('&')).then(
    r => r.ok ? r.json() : { fail: ['Server provided response: ', r.text()] },
    e => ({ fail: 'Error occured: ' + e }));
  if (c.fail)
    return err('Failed to fetch page content. Please reload.',
      (c.fail instanceof Array ? c.fail[0] + await c.fail[1] : c.fail));
  return c;
}

document.addEventListener('DOMContentLoaded', init);