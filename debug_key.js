import fs from 'fs';
const key = process.env.GEMINI_API_KEY;
fs.writeFileSync('key_debug.txt', `Key: ${key}\nType: ${typeof key}\nLength: ${key ? key.length : 0}`);
