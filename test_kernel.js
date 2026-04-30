import fs from 'fs';
const kernel = JSON.parse(fs.readFileSync('kernel_data.json', 'utf8'));
console.log(Object.keys(kernel.nodes).map(k => kernel.nodes[k].state_hash).slice(0, 5));
