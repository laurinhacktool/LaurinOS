import http from 'http';

const data = JSON.stringify({ cmd: "ako sa volas a aky pouzivas model na pozadi?", user: "roman" });

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/core-api/execute',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log("done", res.statusCode, body.substring(0, 500)));
});

req.on('error', error => console.error("req error:", error));

req.write(data);
req.end();
