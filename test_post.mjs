import http from 'http';

const data = JSON.stringify({ cmd: 'Hello Lili, is your API key working?', user: 'roman' });

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/core-api/execute',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
