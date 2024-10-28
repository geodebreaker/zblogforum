const getfile = require('fs').readFileSync;
const extToMIME = {
  html: 'text/html',
  js: 'application/js',
};

require('http').createServer((req, res) => {
  var url = req.url;
  url = url.replaceAll('//', '/');
  url = url.split('/')[0];
  var type = url.length == 1 ? 0 : url.shift();
  if (!type == 0) {
    if (type == 'src')
      type = 1;
    else if (type == 'api')
      type = 2;
    else
      type = 0;
  }
  if (type == 0) {
    var file = getfile('./site/index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(file);
  }
}).listen(8080);

function src(url) {

  try {
    console.log('200:', type, url);
    var file = getfile('./site' + url);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(file);
  } catch (e) {
    console.log('404:', type, url);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found\n\n-- ZBF --');
  }
}

function api(url, params) {

}