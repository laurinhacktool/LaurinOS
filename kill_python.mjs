import { execSync } from 'child_process';
import fs from 'fs';

const dirs = fs.readdirSync('/proc');
for (const dir of dirs) {
  if (/^\d+$/.test(dir)) {
    try {
      const cmdline = fs.readFileSync(`/proc/${dir}/cmdline`, 'utf8');
      if (cmdline.includes('python')) {
        console.log(`Killing ${dir}: ${cmdline}`);
        process.kill(parseInt(dir), 'SIGKILL');
      }
    } catch (e) {
      // ignore
    }
  }
}
