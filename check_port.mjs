import { execSync } from 'child_process';
try {
  const out = execSync('ss -tlnp');
  console.log(out.toString());
} catch (e) {
  console.log("Failed", e.message);
}
