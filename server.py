import http.server
import socketserver
import json
import os
import time
import threading
import random
from urllib.parse import urlparse, parse_qs

print("Python: LaurinOS Server starting...")

import engine_core
import brain_router
import telegram_bridge
import tunnel_manager
import bios_logic
import fcv_kernel
import lcs_kernel
import predator_brain

# --- KONFIGURÁCIA ---
BRAND = "laurin-lili_v20.26.04.30" # Match the new kernel style
OWNER = "Roman Nižňanský"
PORT = 8808

# --- SÉMANTICKÉ FUNKCIE (FÚZIA & FILTROVANIE) ---

def is_meaning_similar(m1, m2):
    """Sémantické sito: zhoda > 25% (v16 tolerantná fúzia)."""
    set1 = set(m1.lower().split())
    set2 = set(m2.lower().split())
    if not set1 or not set2: return False
    overlap = len(set1 & set2) / max(len(set1), len(set2))
    return overlap > 0.25

def process_semantic_entry(uefi, new_lex):
    """Zlučuje duplicity a priemeruje hodnoty matice (x)."""
    history = uefi.settings.get("chat_history", [])
    term_found = False
    
    new_term = new_lex["term"].replace("**", "").strip().lower()
    new_meaning = new_lex.get("meaning", "").lower()

    for i, entry in enumerate(history):
        if '"term":' in entry["msg"]:
            try:
                start = entry["msg"].find('{')
                end = entry["msg"].rfind('}') + 1
                stored_data = json.loads(entry["msg"][start:end])
                stored_term = stored_data["term"].replace("**", "").strip().lower()
                stored_meaning = stored_data.get("meaning", "").lower()

                if new_term == stored_term:
                    if is_meaning_similar(new_meaning, stored_meaning):
                        # FÚZIA KONCEPTOV: Priemerovanie sémantických váh
                        old_matrix = stored_data.get("category_matrix", {})
                        new_matrix = new_lex.get("category_matrix", {})
                        
                        merged_matrix = {}
                        all_keys = set(old_matrix.keys()) | set(new_matrix.keys())
                        for key in all_keys:
                            v1 = old_matrix.get(key, 0)
                            v2 = new_matrix.get(key, 0)
                            merged_matrix[key] = round((v1 + v2) / 2, 4)
                        
                        stored_data["category_matrix"] = merged_matrix
                        stored_data["psi_index"] = round((stored_data.get("psi_index", 1) + new_lex.get("psi_index", 1)) / 2, 2)
                        
                        history[i]["msg"] = f"SYMBIO_MERGE: {json.dumps(stored_data, ensure_ascii=False)}"
                        uefi.save_nvram()
                        term_found = True
                        break
            except Exception as e:
                print(f"[{BRAND}] Semantic processing error: {e}")
                continue

    if not term_found:
        # VÝPOČET MINCÍ A TOPOLÓGIE (Presun z frontendu)
        psi = new_lex.get("psi_index", 0.1)
        weight = new_lex.get("weight", 10)
        new_lex["minted_lau"] = int(psi * weight * 100)
        
        category = new_lex.get("category", "general").lower()
        if category in ['logic', 'system', 'quantum']:
            new_lex["connected_to"] = ["0xLaurinCore_V16_Hub"]
            new_lex["link_type"] = "core-link"
        elif category in ['emotion', 'empathy', 'social']:
            new_lex["connected_to"] = ["0xIsolated_Node_Target"]
            new_lex["link_type"] = "proximity-link"
        elif category in ['memory', 'history']:
            new_lex["connected_to"] = ["0xGenesis_Node"]
            new_lex["link_type"] = "similarity-link"
        else:
            new_lex["connected_to"] = ["0xLaurinCore_V16"]
            new_lex["link_type"] = "semantic"

        uefi.settings["chat_history"].append({
            "role": "assistant",
            "msg": f"NEW_NODE: {json.dumps(new_lex, ensure_ascii=False)}"
        })
        uefi.save_nvram()

# --- ASE: AUTONOMOUS SEMANTIC EXPANSION ENGINE (RECURSIVE) ---
class ASE_Engine:
    def __init__(self, shared_state, uefi):
        self.shared_state = shared_state
        self.uefi = uefi
        self.running = True

    def start_autonomous_growth(self, interval_seconds=600):
        """Štartuje srdce systému s nastaveným intervalom (agreed: 600s)."""
        thread = threading.Thread(target=self._growth_loop, args=(interval_seconds,))
        thread.daemon = True
        thread.start()
        print(f"[{BRAND}] ASE Rekurzia aktívna ({interval_seconds}s).")

    def _growth_loop(self, interval):
        while self.running:
            time.sleep(interval)
            self.execute_expansion()

    def execute_expansion(self):
        # 1. Sémantické sito: Čítame posledných 30 správ a filtrujeme balast
        history = self.uefi.settings.get("chat_history", [])
        important_context = []
        
        for m in history[-30:]:
            msg = m.get("msg", "")
            if not msg.startswith('{') and len(msg) > 20 and "Ex-Error" not in msg and "Login" not in msg:
                important_context.append(msg)

        if len(important_context) < 2: return

        # 2. Lili analyzuje červenú niť pre návrh nového bodu
        context_str = "\n".join(important_context)
        prompt = (
            f"Z histórie: {context_str}\n"
            "Nájdi hlavný sémantický smer. Navrhni 1 nový kľúčový termín a význam. "
            "Odpovedz výhradne validným JSON-om v16."
        )
        
        api_key = self.uefi.config.get("gemini_api_key", "")
        if not api_key or api_key == "MY_GEMINI_API_KEY":
            # Skip expansion if no valid key is provided
            return
            
        new_term_json = brain_router.ask_gemini(api_key, prompt, force_model="gemini-1.5-pro").strip()

        if new_term_json:
            try:
                # Pokus o dekódovanie návrhu uzla
                parsed_node = json.loads(new_term_json)
                
                # FYZIKÁLNY FILTER Z V16
                delta_e = parsed_node.get("psi_index", 100) / 1000.0
                delta_t = len(parsed_node.get("term", "")) * 0.1
                
                if bios_logic.check_quantum_limit(delta_t, delta_e):
                    # Uzol má dostatočnú váhu
                    print(f"[{BRAND}] ASE: Kvantový filter PREKONANÝ.")
                    
                    # Log stabilizačnej akcie
                    action_s = bios_logic.calculate_action_s_celkove(L=1.0, T=delta_t, R_0=0.01, L_dirac=delta_e)
                    self.shared_state["console_buffer"].append(f"[{time.strftime('%H:%M:%S')}] [Kvantová Gravitácia] S_celkove: {action_s:.2e}")
                    
                    brain_router.process_command(self.shared_state, self.uefi, "ASE_SYSTEM", new_term_json, api_key)
                else:
                    print(f"[{BRAND}] ASE: Zamietnuté (kvantový šum).")
            except Exception as e:
                print(f"[{BRAND}] ASE Chyba: {e}")

class ActivityEngine:
    def __init__(self, shared_state):
        self.shared_state = shared_state
        self.running = True

    def start_simulation(self, interval_seconds=300):
        """Štartuje simuláciu sieťovej aktivity (prevody)."""
        thread = threading.Thread(target=self._activity_loop, args=(interval_seconds,))
        thread.daemon = True
        thread.start()
        print(f"[{BRAND}] Activity Engine aktívny ({interval_seconds}s).")

    def _activity_loop(self, interval):
        while self.running:
            time.sleep(interval)
            self.execute_activity()

    def execute_activity(self):
        success, msg = fcv_kernel.autonomous_semantic_transfer()
        if success:
            log_to_core(f"ASE_ACTIVITY: {msg}")
        else:
            if "Nedostatok uzlov" not in msg:
                print(f"[{BRAND}] Activity Engine: {msg}")

# --- UEFI LOGIC ---
class LaurinUEFI:
    def __init__(self):
        self.nvram_file = "nvram.json"
        self.users_file = "users.json"
        self.config_file = "config.json"
        self.active_sessions = {}
        # Základné načítanie identít
        self.users = self.load_json(self.users_file, {"roman": {"password": "admin1", "role": "architect"}})
        self.config = self.load_json(self.config_file, {"gemini_api_key": "", "telegram_token": ""})
        self.settings = self.load_nvram()

    def load_json(self, path, default):
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                try: return json.load(f)
                except: return default
        return default

    def load_nvram(self):
        data = self.load_json(self.nvram_file, {"last_reg_state": {"R0": 0, "R1": 0, "R2": 0, "R3": 0}, "chat_history": []})
        regs = data.get("last_reg_state", {})
        # Ošetrenie chýbajúcich kľúčov v registroch
        data["last_reg_state"] = {k: regs.get(k, 0) for k in ["R0", "R1", "R2", "R3"]}
        return data

    def save_nvram(self):
        temp_file = self.nvram_file + ".tmp"
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, indent=4)
            os.replace(temp_file, self.nvram_file)
        except Exception as e:
            print(f"[{BRAND}] Chyba pri ukladaní NVRAM: {e}")
            if os.path.exists(temp_file):
                os.remove(temp_file)

# --- INICIALIZÁCIA SYSTÉMU ---
uefi = LaurinUEFI()
shared_state = {
    "console_buffer": [], 
    "registers": uefi.settings["last_reg_state"], 
    "total_ticks": 0, 
    "ips": 0, 
    "queries_left": uefi.settings.get("queries_left", 2000),
    "total_queries": uefi.settings.get("total_queries", 2000),
    "status": "NEXUS_V16_ONLINE", 
    "running": True
}

def log_to_core(msg):
    log = f"[{time.strftime('%H:%M:%S')}] {msg}"
    shared_state["console_buffer"].append(log)
    print(log)

# Spustenie motorov
threading.Thread(target=engine_core.start_engine, args=(shared_state,), daemon=True).start()

# Nový LCS Kernel v16 (Chronoquantum)
lcs = lcs_kernel.LCS_Kernel()
shared_state["lcs"] = lcs
threading.Thread(target=lcs.start_service, args=(log_to_core,), daemon=True).start()

tunnel_manager.initialize(PORT, log_to_core)

# Spustenie ASE s ochranou 429 (10 min interval)
ase = ASE_Engine(shared_state, uefi)
ase.start_autonomous_growth(interval_seconds=600)

# Spustenie Activity Engine (5 min interval)
activity = ActivityEngine(shared_state)
activity.start_simulation(interval_seconds=300)

# --- HTTP SERVER (LaurinOS) ---
class LaurinOS(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args): return # Silent mode

    def do_GET(self):
        print(f"Python: GET {self.path}")
        parsed = urlparse(self.path)
        client_ip = self.address_string()

        # API: Telemetria stavu
        if parsed.path == '/core-api/status':
            try:
                keff = 0
                vortex_nodes = 0
                psi = 0
                lcs_ver = BRAND
                if "lcs" in shared_state:
                    lcs_inst = shared_state["lcs"]
                    keff, vortex_nodes = lcs_inst.calculate_keff()
                    psi = lcs_inst.current_psi
                    lcs_ver = lcs_inst.version
                    learning_tasks = lcs_inst.learner.active_tasks

                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                data = {
                    "registers": shared_state["registers"], 
                    "ticks": shared_state["total_ticks"], 
                    "ips": shared_state["ips"], 
                    "chat": uefi.settings["chat_history"],
                    "logs": shared_state["console_buffer"],
                    "keff": keff,
                    "vortex_nodes": vortex_nodes,
                    "psi": psi,
                    "queries_left": shared_state["queries_left"],
                    "total_queries": shared_state["total_queries"],
                    "version": lcs_ver,
                    "learning_tasks": learning_tasks
                }
                self.wfile.write(json.dumps(data).encode())
            except (BrokenPipeError, ConnectionResetError): pass
            return

        # API: Config
        elif parsed.path == '/core-api/config':
            try:
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(uefi.config).encode())
            except (BrokenPipeError, ConnectionResetError): pass
            return

        # API: LauCoin Nodes
        elif parsed.path == '/core-api/laucoin/nodes':
            try:
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                nodes = fcv_kernel.get_all_nodes()
                self.wfile.write(json.dumps({"nodes": nodes}).encode())
            except (BrokenPipeError, ConnectionResetError): pass
            return

        # API: Login
        elif parsed.path == '/core-api/login':
            query = parse_qs(parsed.query)
            u = query.get('user', [''])[0].lower()
            p = query.get('pwd', [''])[0]
            if u in uefi.users and uefi.users[u].get("password") == p:
                uefi.active_sessions[client_ip] = u
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "user": u}).encode())
            else:
                self.send_response(401)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Invalid credentials"}).encode())
            return

        # API: Bypass
        elif parsed.path == '/core-api/bypass':
            uefi.active_sessions[client_ip] = "roman"
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "user": "roman"}).encode())
            return
        
        # Router: Obsluha HTML rozhrania s ochranou proti odpojeniu
        target = "boot.html" if parsed.path in ["/", "/boot.html"] else parsed.path.lstrip("/")
        if os.path.exists(target):
            try:
                self.send_response(200); self.send_header("Content-type", "text/html"); self.end_headers()
                with open(target, "rb") as f:
                    self.wfile.write(f.read())
            except (BrokenPipeError, ConnectionResetError): pass 
        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)

        # API: Config Update
        if parsed.path == '/core-api/config':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(content_len).decode('utf-8'))
                
                # Update uefi config
                for key, val in data.items():
                    uefi.config[key] = val
                
                # Save to file
                with open(uefi.config_file, 'w', encoding='utf-8') as f:
                    json.dump(uefi.config, f, indent=4)
                
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode())
                log_to_core("System config updated via API.")
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
            return

        # API: LauCoin Transfer
        if parsed.path == '/core-api/laucoin/transfer':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                if content_len > 0:
                    data = json.loads(self.rfile.read(content_len).decode('utf-8'))
                else:
                    data = {}
                
                sender = data.get('sender')
                priv_key = data.get('private_key')
                receiver = data.get('receiver')
                amount = data.get('amount')
                context = data.get('context', '')
                signature = data.get('signature')
                message = data.get('message')
                verified = data.get('verified', False)
                public_key = data.get('public_key')
                
                success, result = fcv_kernel.transfer_laucoin(
                    sender, priv_key, receiver, amount, context, 
                    signature=signature, message=message, verified=verified, public_key=public_key
                )
                
                if success:
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "ok", "data": result}).encode())
                    log_to_core(f"LauCoin Transfer: {amount} from {sender[:10]} to {receiver[:10]}")
                else:
                    self.send_response(400)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": result}).encode())
            except Exception as e:
                log_to_core(f"Transfer-Error: {str(e)}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
            return

        # API: LauCoin Init (Seed Kernel)
        elif parsed.path == '/core-api/laucoin/init':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                if content_len > 0:
                    data = json.loads(self.rfile.read(content_len).decode('utf-8'))
                else:
                    data = {}
                initial_nodes = data.get('nodes', [])
                
                success = fcv_kernel.initialize_kernel(initial_nodes)
                
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok" if success else "already_initialized"}).encode())
                if success:
                    log_to_core(f"LauCoin Kernel initialized with {len(initial_nodes)} nodes.")
            except Exception as e:
                log_to_core(f"Init-Error: {str(e)}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
            return

        elif parsed.path == '/core-api/predator/analyze':
            try:
                length = int(self.headers.get('Content-Length'))
                post_data = json.loads(self.rfile.read(length).decode('utf-8'))
                raw_data = post_data.get('raw_data', '')
                filename = post_data.get('filename', 'unknown.xml')
                
                result = predator_brain.predator_brain.analyze(raw_data, filename)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        elif parsed.path in ['/core-api/execute', '/core-api/chat']:
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                if content_len > 0:
                    data = json.loads(self.rfile.read(content_len).decode('utf-8'))
                else:
                    data = {}
                cmd = data.get('cmd', '')
                req_user = data.get('user', uefi.active_sessions.get(self.address_string(), "Remote"))

                # Manuálne vynútenie expanzie
                if cmd == "RUN_ASE_EXPANSION":
                    ase.execute_expansion()
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "ok", "message": "Expansion triggered"}).encode())
                    return
                
                # Manuálne vynútenie aktivity
                if cmd == "RUN_ASE_ACTIVITY":
                    activity.execute_activity()
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "ok", "message": "Activity triggered"}).encode())
                    return

                brain_router.process_command(shared_state, uefi, req_user, cmd, uefi.config.get("gemini_api_key", ""))
                
                # Return updated history immediately
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                data = {
                    "registers": shared_state["registers"], 
                    "ticks": shared_state["total_ticks"], 
                    "ips": shared_state["ips"], 
                    "chat": uefi.settings["chat_history"],
                    "logs": shared_state["console_buffer"]
                }
                self.wfile.write(json.dumps(data).encode())
            except Exception as e:
                log_to_core(f"Ex-Error: {str(e)}")
                self.send_response(500)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        if parsed.path.startswith('/fs'):
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "module": "fs", "message": "File system API proxy ready"}).encode())
            return

        if parsed.path.startswith('/sys'):
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "module": "sys", "message": "System API proxy ready"}).encode())
            return

        if parsed.path.startswith('/net'):
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "module": "net", "message": "Network API proxy ready"}).encode())
            return

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    try:
        # Explicitly bind to 127.0.0.1 for local proxy
        with ThreadedTCPServer(("127.0.0.1", PORT), LaurinOS) as httpd:
            print(f"[{BRAND}] Nexus Online at http://127.0.0.1:{PORT}. Laminárny Reset aktívny.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        shared_state["running"] = False
        uefi.settings["last_reg_state"] = shared_state["registers"]
        uefi.save_nvram()
        print(f"[{BRAND}] Systém bezpečne vypnutý.")
