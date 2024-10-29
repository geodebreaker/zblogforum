$ = x => document.querySelector(x);

function init() {
  window.onpopstate = (e) => new Promise(y => y(go(null, e.state)));
  go()
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
    history.replaceState({ttl: Date.now(), stat: c}, '', loc);
  } else {
    c = stat.stat;
  }
  $('#content').innerHTML = c.html;
  $('title').innerText = c.title;
}

function err(...e) {
  alert(e.join('\n'))
}

init();