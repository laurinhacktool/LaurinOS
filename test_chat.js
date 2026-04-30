import http from 'http';

const data = JSON.stringify({ cmd: "vypocitaj r1", user: "roman" });

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

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
      const json = JSON.parse(body);
      console.log(json.chat[json.chat.length - 1]);
  });
});

req.write(data);
req.end();
