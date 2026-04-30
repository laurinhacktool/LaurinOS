import subprocess
import threading

class TunnelManager:
    def __init__(self, port=8808):
        self.port = port
        self.public_url = None
        self.process = None

    def start_tunnel(self, callback_msg):
        def run():
            cmd = f"ssh -R 80:localhost:{self.port} nokey@localhost.run"
            self.process = subprocess.Popen(
                cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
            )
            
            for line in self.process.stdout:
                if ".lhr.life" in line or "tunneled with tls" in line:
                    parts = line.split("https://")
                    if len(parts) > 1:
                        url = "https://" + parts[1].split()[0].strip()
                        self.public_url = url
                        callback_msg(f"Lili: Globálna brána otvorená at: {url}")
                        break

        threading.Thread(target=run, daemon=True).start()

def initialize(port, callback):
    tm = TunnelManager(port)
    tm.start_tunnel(callback)
    return tm
