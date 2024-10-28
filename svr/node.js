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
      if(!params.q)
        return ret();
      ret(content(params.q));
      break;
    default:
      ret();
      break;
  }
}

function content(ourl) {
  var url = ourl.split('/');
  url.shift();
  var type = url.shift() ?? '';
  url = url.join('/');
  switch (type) {
    case '':
      return {type: 'html', html: `<h3>MAIN PAGE</h3><hr><div>TIME: ${Date.now().toString(16).slice(-8, -2)}</div>`};
    default:
      return {type: 'html', html: '404 Not Found'};
  }
}