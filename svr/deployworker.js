var js = require('fs').readFileSync('./svr/node.js').toString();

js = js.replace(`require('http').createServer`, `const handleRequest = `).replace('.listen(8080)', '') + 
`addEventListener('fetch', event => {
  var res = new function() {
    this.init = { status: 200, headers: {} };
    this.writeHead = function (status, headers) {
      this.init.status = status;
      this.init.headers = { ...this.init.headers, ...headers };
    };
    this.end = function (data) {
      if(this.body)
        this.body += data;
      else
        this.body = data;
    }
    this.deploy = function () {
      return new Response(this.body, this.init);
    }
  };
  handleRequest(event.request, res);
  event.respondWith(res.deploy());
});`;

console.log(js);
