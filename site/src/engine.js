$ = (x, y = document) => y.querySelector(x);

function init() {
  window.onerror = alert;
  window.onpopstate = e => new Promise(y => y(go(null, e.state)));
  window.addEventListener('click', e => {
    if (e.target.tagName == 'A') {
      e.preventDefault();
      go(e.target.href);
    }
  });
  go();
}

async function go(loc, stat) {
  if (loc && !stat)
    history.pushState({}, '', loc);
  if (!(stat && stat.ttl >= Date.now() - 60e3)) {
    var c = await fetch('/api/content?q=' + encodeURI(loc ?? location.pathname)).then(
      r => r.ok ? r.json() : { fail: ['Server provided response: ', r.text()] },
      e => ({ fail: 'Error occured: ' + e }));
    if (c.fail)
      return err('Failed to fetch page content. Please reload.',
        (c.fail instanceof Array ? c.fail[0] + await c.fail[1] : c.fail));
    history.replaceState({ ttl: Date.now(), stat: c }, '', loc);
  } else {
    c = stat.stat;
  }
  $('#content').innerHTML = c.html +
    module('postslot', {
      site: '/h',
      name: 'pp',
      user: module('userlink', {
        user: 'geodebreaker'
      })
    })
  $('title').innerText = c.title;
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

init();