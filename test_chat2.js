import http from 'http';

const data = JSON.stringify({ cmd: "ping", user: "roman" });

const options = {
  hostname: '127.0.0.1',
  port: 8808,
  path: '/api/execute',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log("sending req...");
const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log("done", body.substring(0, 500)));
});

req.setTimeout(5000, () => {
    console.error("timeout");
    req.destroy();
});

req.on('error', error => console.error("req error:", error));

req.write(data);
req.end();
