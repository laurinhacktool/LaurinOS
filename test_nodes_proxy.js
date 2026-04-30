import http from 'http';

http.get('http://127.0.0.1:3000/core-api/laucoin/nodes', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status Code:", res.statusCode);
    console.log("Body:", data);
  });
});
