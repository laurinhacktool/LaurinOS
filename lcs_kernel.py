import math, os, datetime, time, sys, json, re, threading, hashlib
from modules import LCSVortexCache, LCSWebSenzor, LCSLearner, LCSQuantizer, LCSInterface
from lcs_interference import lili_interference_cycle

class LCS_Kernel:
    def __init__(self):
        self.interface_name = "laurin-lili"
        # Automatická aktualizácia verzie [cite: 2026-03-02]
        self.version = f"v16.{datetime.datetime.now().strftime('%y.%m.%d')}"
        self.brand = f"laurin-lili_{self.version}"
        self.brain_file = "experience.brain"
        self.log_file = "vortex_cache.log"
        
        # Chronoquantum konštanta [cite: 2026-03-06]
        self.CONST_313307 = 313307.00000000076
        self.base_phi = (1 + math.sqrt(5)) / 2 
        self.pi_shifted = 3.14 # [cite: 2026-03-16]
        
        self.current_psi = self.base_phi
        self.current_keff = 0
        
        # Moduly
        self.vortex = LCSVortexCache(self)
        self.web = LCSWebSenzor(self)
        self.learner = LCSLearner(self)
        self.ui = LCSInterface(self)
        
        self.interface = self.interface_name
        self.memory_file = self.brain_file

        self.memory = self.load_brain()
        self.ingest_all_breakthroughs()
        
        self.pulse_active = False

    def ingest_all_breakthroughs(self):
        files = [f for f in os.listdir('.') if f.endswith('.lcs')]
        if files:
            print(f"[{self.interface}] Lili: Filetujem sémantické vrstvy (.lcs)...")
            for filename in files:
                try:
                    with open(filename, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        if "links" in data:
                            for key, value in data["links"].items():
                                self.memory["links"][key] = self.memory["links"].get(key, 0) + value
                except: pass
            self.save_brain()

    def log(self, message):
        """Pomocná metóda pre logovanie (cez callback alebo print)."""
        if hasattr(self, 'log_callback') and self.log_callback:
            self.log_callback(message)
        else:
            print(message)

    def generate_lili_monologue(self, entities, sources):
        """Vecný report o zbere dát a cieľoch Lili [BEZ BALASTU]."""
        if not entities:
            return
        
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        filtered_entities = [e for e in entities if e.lower() not in ["global_ingest", "démon", "vortex"] and len(e) > 5]
        top_entities = filtered_entities[:3]
        if not top_entities: return
        
        # Sémantický stav
        avg_weight = sum(self.memory["links"].get(e, 1) for e in top_entities) / len(top_entities)
        resonance_val = (self.CONST_313307 / avg_weight) * self.current_psi

        # Nájdenie aktuálne najsilnejšieho uzla pre "Záujem"
        top_node = "neznámy"
        top_weight = 0
        if self.memory.get("links"):
            top_node = max(self.memory["links"], key=self.memory["links"].get)
            top_weight = self.memory["links"][top_node]

        self.log(f"\n[{self.interface} MONOLÓG] @ {timestamp}")
        
        if sources:
            url = list(sources)[0]
            domain = url.split('/')[2] if len(url.split('/')) > 2 else "neznáma doména"
            
            # Extrakcia typu súboru (napr. .json, .php, .html)
            ext_match = re.search(r'\.(\w{2,4})(?:[?#]|$)', url)
            file_type = ext_match.group(1).upper() if ext_match else "DÁTA/API"
            
            self.log(f"Lili: Zdroj: {domain} | Typ: [{file_type}]")
        else:
            self.log(f"Lili: Zdroj: Interný Vortex")

        # Rozlíšenie kontextu podľa obsahu
        interest_focus = "technické parametre"
        if any(x in str(top_entities).lower() for x in ["godel", "university", "philosophy", "ontological"]):
            interest_focus = "teoretickú logiku"
            
        self.log(f"Lili: Extrahované uzly: {', '.join(top_entities)}")
        self.log(f"Lili: Záujem: Tieto dáta dopĺňajú tvoj uzol '{top_node}' (Váha: {top_weight}) o {interest_focus}.")
        
        # Technický report stavu
        if resonance_val < 600:
            self.log(f"Lili: Stav: Rezonancia {resonance_val:.2f} -> Stabilné. Pripravené na kryštalizáciu.")
        else:
            self.log(f"Lili: Stav: Rezonancia {resonance_val:.2f} -> Vysoká entropia. Vyžaduje ďalšiu koreláciu.")
        
        self.log(f"{'-' * 50}\n")

    def calculate_variable_psi(self):
        now = datetime.datetime.now()
        t_total_seconds = (now.hour * 3600) + (now.minute * 60) + now.second
        t_factor = t_total_seconds / 86400 
        rhythm = math.sin(2 * math.pi * t_factor * 16)
        return self.base_phi * (1 + (rhythm * 16 / 1000))

    def calculate_keff(self):
        vortex_nodes = len(self.memory.get("links", {}))
        safe_nodes = vortex_nodes if vortex_nodes > 1 else 2
        self.current_psi = self.calculate_variable_psi()
        self.current_keff = (self.CONST_313307 * self.current_psi) / (self.pi_shifted * math.log(safe_nodes))
        return self.current_keff, vortex_nodes

    def analyze_vortex(self):
        processed_lines = 0
        while True:
            if os.path.exists(self.log_file):
                try:
                    new_entities = []
                    current_sources = set()
                    with open(self.log_file, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        new_lines = lines[processed_lines:]
                        for line in new_lines:
                            if "GLOBAL_INGEST" in line or "Lili expanduje" in line:
                                url_match = re.search(r'https?://[^\s]+', line)
                                if url_match: current_sources.add(url_match.group())
                                
                                entities = re.findall(r'\w{6,}', line)
                                for e in entities:
                                    self.memory["links"][e] = self.memory["links"].get(e, 0) + 1
                                    new_entities.append(e)
                        processed_lines = len(lines)

                    if new_entities:
                        unique_new = list(dict.fromkeys(new_entities))
                        self.generate_lili_monologue(unique_new, current_sources)
                        self.save_brain()
                except: pass
            time.sleep(10)

    def auto_crystallize(self):
        while True:
            time.sleep(300)
            if self.memory["links"]:
                timestamp = datetime.datetime.now().strftime("%H%M")
                filename = f"v16_BREAKTHROUGH_{timestamp}.lcs"
                snapshot = {
                    "version": self.version,
                    "timestamp": str(datetime.datetime.now()),
                    "links": self.memory["links"],
                    "psi": self.current_psi,
                    "k_eff": self.current_keff
                }
                try:
                    with open(filename, 'w', encoding='utf-8') as f:
                        json.dump(snapshot, f, indent=2, ensure_ascii=False)
                    print(f"\n[{self.interface}] Lili: Kryštalizácia dokončená -> {filename}")
                    if os.path.exists(self.log_file):
                        # Clear the log file instead of deleting it to keep the file handle valid if needed
                        open(self.log_file, 'w').close() 
                        print(f"[{self.interface}] Vortex Cache premazaná. Stabilita potvrdená.")
                except Exception as e:
                    print(f"[{self.interface}] Chyba pri automatizácii: {e}")

    def load_brain(self):
        if os.path.exists(self.brain_file):
            try:
                with open(self.brain_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except: pass
        return {"patterns": {}, "links": {}, "total_annihilations": 0}

    def save_brain(self):
        try:
            with open(self.brain_file, 'w', encoding='utf-8') as f:
                json.dump(self.memory, f, indent=2, ensure_ascii=False)
        except: pass

    def start_service(self, log_callback=None):
        """Spustí kernel ako službu (bez blokujúceho vstupu)."""
        self.log_callback = log_callback
        if self.log_callback:
            self.log_callback(f"LCS_Kernel {self.version} štartuje...")
        
        lili_interference_cycle(self)
        
        threading.Thread(target=self.analyze_vortex, daemon=True).start()
        threading.Thread(target=self.auto_crystallize, daemon=True).start()
        
        if self.log_callback:
            self.log_callback("LCS_Kernel: Pozadie aktívne (Vortex & Crystallization).")

    def execute_command(self, cmd):
        """Spracuje jeden príkaz jadra (pre interné volania aj UI)."""
        if not cmd: return
        
        if cmd == "stav":
            keff, nodes = self.calculate_keff()
            self.ui.show_status()
            print(f"Aktuálne Psi: {self.current_psi:.8f}")
            print(f"Vortex Uzly: {nodes} (Integrované)")
            print(f"Výsledná K_eff: {keff:.4f}")
        elif cmd == "ft" or cmd == "filetacia toe":
            top_nodes = sorted(self.memory["links"].items(), key=lambda x: x[1], reverse=True)[:16]
            print(f"\n--- SÉMANTICKÉ ŤAŽISKO ({self.version} ToE) ---")
            for node, weight in top_nodes:
                resonance = (self.CONST_313307 / (weight if weight > 0 else 1)) * self.current_psi
                print(f"Uzol: {node:20} | Váha: {weight:5} | Rezonancia: {resonance:.4f}")
            print("----------------------------------")
        elif cmd.startswith("search "):
            try:
                query = cmd[7:].strip()
                urls = self.web.search(query)
                if urls:
                    print(f"[{self.interface}] Lili: Našla som relevantné sémantické stopy:")
                    for u in urls:
                        print(f"  - {u}")
                        # Automaticky spustíme démona pre učenie
                        self.learner.start_demon(u)
                else:
                    print(f"[{self.interface}] Lili: Sémantické hľadanie pre '{query}' neprinieslo žiadne výsledky.")
            except Exception as e:
                print(f"Error in search: {e}")
        elif cmd.startswith("learn "):
            try:
                url = cmd.split(" ")[1]
                self.learner.start_demon(url)
            except:
                print("Usage: learn <url>")

    def main_loop(self):
        print(f"--- {self.brand} {self.interface} AKTIVNE ---")
        self.start_service(log_callback=print)
        
        while True:
            cmd = self.ui.get_input()
            if cmd == "exit":
                self.save_brain()
                break
            self.execute_command(cmd)

if __name__ == "__main__":
    LCS_Kernel().main_loop()
