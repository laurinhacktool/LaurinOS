import os
import json
import random
import time
import re
import threading
import urllib.request
import urllib.parse
from gemini_bridge import ask_gemini

class LCSVortexCache:
    def __init__(self, kernel):
        self.kernel = kernel
        self.log_file = kernel.log_file

    def log(self, type, message):
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        entry = f"[{timestamp}] [{type}] {message}\n"
        # Log to file
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(entry)
        except:
            pass
        # Log to kernel callback (UI)
        self.kernel.log(f"VORTEX: [{type}] {message}")

class LCSWebSenzor:
    def __init__(self, kernel):
        self.kernel = kernel

    def fetch_content(self, url):
        """Skutočný zber dát z HTTP zdroja."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (LaurinOS; Lili Core v20.26.04.30) sémantický-senzor/1.0'
            }
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                content = response.read().decode('utf-8', errors='ignore')
                # Odstránenie HTML tagov (veľmi jednoduché)
                text = re.sub(r'<[^>]+>', ' ', content)
                # Normalizácia whitespace
                text = ' '.join(text.split())
                return text[:5000] # Limit pre Gemini kontext
        except Exception as e:
            self.kernel.vortex.log("FETCH_ERROR", f"Chyba pri sťahovaní {url}: {e}")
            return None

    def search(self, query):
        """Vyhľadávanie relevantných sémantických stôp."""
        self.kernel.vortex.log("SEARCH_INIT", f"Searching for: {query}")
        
        # Využitie Gemini na určenie kam sa "pozrieť" alebo simuláciu vyhľadávania
        # V skutočnosti tu môžeme použiť search API, ak by bolo dostupné, 
        # ale Lili dokáže 'predpovedať' relevantné zdroje.
        
        prompt = f"Si Lili (LCS). Užívateľ chce hľadať: '{query}'. Navrhni 3 reálne URL adresy (napr. wikipedia, tech dokumentácia), ktoré by obsahovali sémantické informácie k téme. Vráť len zoznam URL oddelený čiarkou."
        
        # Získame API kľúč z kernelu alebo environmentu
        api_key = os.environ.get("GEMINI_API_KEY") 
        try:
            reply = ask_gemini(api_key, prompt)
            urls = [u.strip() for u in reply.split(",") if "http" in u]
            return urls
        except:
            return []

    def ingest(self, url):
        self.kernel.vortex.log("GLOBAL_INGEST", f"Ingesting data from {url}")
        text = self.fetch_content(url)
        if text:
            self.kernel.vortex.log("CONTENT_ACQUIRED", f"Acquired {len(text)} bytes from {url}")
            self.kernel.learner.analyze(text, source=url)
        else:
            self.kernel.vortex.log("INGEST_FAILED", f"No content available from {url}")

class LCSLearner:
    def __init__(self, kernel):
        self.kernel = kernel
        self.active_tasks = {} # url -> info

    def start_demon(self, url):
        self.active_tasks[url] = {
            "status": "starting",
            "progress": 0,
            "entities": [],
            "start_time": time.time()
        }
        print(f"[{self.kernel.interface}] LCSLearner: Štartujem sémantického démona pre {url}")
        thread = threading.Thread(target=self._demon_process, args=(url,), daemon=True)
        thread.start()

    def _demon_process(self, url):
        if url in self.active_tasks:
            self.active_tasks[url]["status"] = "ingesting"
            self.active_tasks[url]["progress"] = 20
            
        self.kernel.web.ingest(url)
        
        if url in self.active_tasks:
            self.active_tasks[url]["status"] = "completed"
            self.active_tasks[url]["progress"] = 100
        print(f"[{self.kernel.interface}] LCSLearner: Sémantická analýza {url} dokončená.")

    def analyze(self, text, source="unknown"):
        """Využíva Gemini na extrakciu vedomostí z textu."""
        if source in self.active_tasks:
            self.active_tasks[source]["status"] = "analyzing"
            self.active_tasks[source]["progress"] = 50
            
        api_key = os.environ.get("GEMINI_API_KEY")
        
        prompt = f"""
        Analyzuj nasledujúci text a extrahuj z neho sémantické entity a koncepty pre vedomostnú bázu Lili-LCS.
        Zdroj: {source}
        Text: {text[:3000]}
        
        Vráť výsledok ako JSON objekt:
        {{
          "entities": ["názov1", "názov2", ...],
          "summary": "Krátke zhrnutie naučeného",
          "links": {{ "entita": váha_významu_1_až_10 }}
        }}
        """
        
        try:
            reply = ask_gemini(api_key, prompt)
            # Extrakcia JSONu
            json_match = re.search(r'\{.*\}', reply, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                learned = []
                for entity, weight in data.get("links", {}).items():
                    # Zápis do logu, ktorý lcs_kernel analyzuje
                    self.kernel.vortex.log("ENTITY_LEARNED", f"Learned entity '{entity}' with weight {weight} from {source}")
                    # Priamy zápis do pamäte kernelu (ak chceme okamžitý efekt)
                    self.kernel.memory["links"][entity] = self.kernel.memory["links"].get(entity, 0) + weight
                    learned.append(entity)
                
                if source in self.active_tasks:
                    self.active_tasks[source]["entities"] = learned
                    self.active_tasks[source]["progress"] = 90
                
                self.kernel.log(f"Lili: Naučila som sa nové koncepty: {', '.join(data.get('entities', []))}")
                self.kernel.save_brain()
        except Exception as e:
            if source in self.active_tasks:
                self.active_tasks[source]["status"] = "error"
                self.active_tasks[source]["error"] = str(e)
            print(f"LCSLearner: Chyba pri analýze: {e}")

class LCSQuantizer:
    def __init__(self, kernel):
        self.kernel = kernel

    def quantize(self, value):
        return round(value / self.kernel.CONST_313307, 10)

class LCSInterface:
    def __init__(self, kernel):
        self.kernel = kernel

    def get_input(self):
        try:
            return input(f"Lili@{self.kernel.version}:~$ ").strip().lower()
        except EOFError:
            return "exit"

    def show_status(self):
        print(f"\n--- {self.kernel.brand} STATUS ---")
        print(f"Verzia: {self.kernel.version}")
        print(f"Konštanta: {self.kernel.CONST_313307}")
        print(f"Psi (base): {self.kernel.base_phi}")
        print(f"Brain: {self.kernel.brain_file}")
        print(f"Vortex: {self.kernel.log_file}")
        print("--------------------------\n")
