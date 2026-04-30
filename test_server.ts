import { spawn } from "child_process";

const proc = spawn("python3", ["server.py"]);

proc.stdout.on("data", (data) => {
  console.log(`STDOUT: ${data}`);
});

proc.stderr.on("data", (data) => {
  console.error(`STDERR: ${data}`);
});

proc.on("close", (code) => {
  console.log(`Process exited with code ${code}`);
});

setTimeout(() => {
  proc.kill();
  console.log("Killed after 5 seconds");
  process.exit(0);
}, 5000);
