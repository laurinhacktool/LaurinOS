import crypto from 'crypto';
const PI = 3.14159265359;
const addr = '0xLaurinCore_Genesis';
const msg = `${addr}${PI}semantic`;
const hash = crypto.createHash('sha256').update(msg).digest('hex');
console.log(`0x${hash}`);
