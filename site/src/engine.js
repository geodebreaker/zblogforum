$ = x => document.querySelector(x);

async function go(loc) {
  if (loc)
    history.pushState({}, '', loc);
  var c = await fetch('/api/content?q=' + encodeURI(loc ?? location.pathname)).then(
    r => r.ok ? r.json() : { fail: ['Server provided response: ', r.text()] },
    e => ({ fail: 'Error occured: ' + e }));
  if (c.fail)
    return err('Failed to fetch page content. Please reload.',
      (c.fail instanceof Array ? c.fail[0] + await c.fail[1] : c.fail));
  $('#content').innerHTML = c.page;
}

function err(...e) {
  alert(e.join('\n'))
}

go();