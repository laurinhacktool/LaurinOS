import { spawn } from 'child_process';
const env = { ...process.env, TEST_VAR: undefined };
const proc = spawn('python3', ['-c', 'import os; print(os.environ.get("TEST_VAR"))'], { env });
proc.stdout.on('data', d => console.log(d.toString()));
