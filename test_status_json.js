import http from 'http';

http.get('http://127.0.0.1:3000/core-api/status', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status Code:", res.statusCode);
    console.log("Content-Type:", res.headers['content-type']);
    console.log("Body preview:", data.substring(0, 200));
    try {
      JSON.parse(data);
      console.log("JSON parsing: SUCCESS");
    } catch (e) {
      console.log("JSON parsing: FAILED", e.message);
    }
  });
});
