import https from 'https';

const apiKey = process.env.GEMINI_API_KEY;
console.log('Key length:', apiKey ? apiKey.length : 0);

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
const data = JSON.stringify({"contents": [{"parts": [{"text": "hello"}]}]});

const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', console.error);
req.write(data);
req.end();
