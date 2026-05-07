import http.server
import socketserver
import json
import os
import time
import threading
import random
from urllib.parse import urlparse, parse_qs

import engine_core
import telegram_bridge
import tunnel_manager
import bios_logic
import gemini_bridge
import ollama_bridge
import quantummind_logic
import semantic_parser
import agent_dispatcher
import sensory_bridge
import evolution_engine

# --- KONFIGURÁCIA ---
BRAND = "laurin-lili_v20.26.04.30"
OWNER = "Roman Nižňanský"
PORT = 8808
LAST_API_CALL = 0
MIN_GAP = 2.5  # Zvýšené pre stabilizáciu toku a predchádzanie 429 chybám

# --- SÉMANTICKÉ FUNKCIE (FÚZIA & FILTROVANIE) ---

def get_wallet(uefi, user):
    """Získa alebo vytvorí peňaženku pre užívateľa."""
    wallets = uefi.settings.setdefault("wallets", {})
    return wallets.setdefault(user, {"balance": 0, "transactions": []})

def transfer_laucoin(uefi, sender, receiver, amount):
    """Prevedie Laucoin medzi užívateľmi."""
    sender_wallet = get_wallet(uefi, sender)
    if sender_wallet["balance"] < amount:
        return False, "Nedostatok Laucoinov."
    
    receiver_wallet = get_wallet(uefi, receiver)
    
    sender_wallet["balance"] -= amount
    receiver_wallet["balance"] += amount
    
    sender_wallet["transactions"].append({"type": "send", "to": receiver, "amount": amount, "timestamp": time.strftime("%H:%M:%S")})
    receiver_wallet["transactions"].append({"type": "receive", "from": sender, "amount": amount, "timestamp": time.strftime("%H:%M:%S")})
    
    uefi.save_nvram()
    return True, "Prevod úspešný."

def load_persona():
    """Načíta identitu a pravidlá rozhrania."""
    path = "persona.json"
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            try: return json.load(f)
            except: return {}
    return {}

def ask_ai(uefi, prompt, force_model=None):
    """
    Univerzálny AI router, ktorý prepína medzi Gemini a Ollama s fallbackom.
    """
    provider = uefi.config.get("preferred_provider", "gemini")
    
    if provider == "local":
        model_path = uefi.config.get("local_model_path", "")
        if model_path:
            try:
                import urllib.request
                import json
                req = urllib.request.Request(
                    "http://127.0.0.1:3000/api/local-chat",
                    data=json.dumps({"prompt": prompt, "model_path": model_path}).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=120) as response:
                    res_body = response.read().decode('utf-8')
                    data = json.loads(res_body)
                    if "response" in data:
                        return data["response"]
                    else:
                        return f"⚠️ Lokálny model API chyba: {data.get('error', 'Neznáma chyba')}"
            except Exception as e:
                print(f"[Core] Chyba pri lokálnom modeli ({model_path}): {e}")
                # Fallback to Gemini handled below...
        else:
            print("[Core] Žiadna cesta k lokálnemu modelu, fallback na Gemini...")

    # Ak je preferovaná Ollama, skúsime ju
    if provider == "ollama" or provider == "local":
        model = uefi.config.get("custom_model") or "llama3"
        url = uefi.config.get("custom_api_url") or "http://localhost:11434"
        response = ollama_bridge.ask_ollama(prompt, model=model, url=url)
        
        # Ak Ollama vrátila chybu (začína varovným emoji), skúsime fallback na Gemini
        if response.startswith("⚠️"):
            print(f"[Core] Ollama nedostupná, aktivujem Fallback na Gemini...")
            api_key = uefi.config.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
            fallback_response = ask_gemini(api_key, prompt, force_model=force_model)
            return f"{response}\n\n[SYSTEM FALLBACK: Gemini 1.5 Flash]\n{fallback_response}"
        
        return response
    
    # Štandardné Gemini
    api_key = uefi.config.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
    return ask_gemini(api_key, prompt, force_model=force_model)

def ask_gemini(api_key, prompt, retries=5, force_model=None):
    global LAST_API_CALL
    if not api_key or api_key in ["MY_GEMINI_API_KEY", "undefined", "null", ""]:
        # Priority: MY_GEMINI_API_KEY -> GEMINI_API_KEY
        real_key = os.environ.get("MY_GEMINI_API_KEY")
        if not real_key or real_key in ["MY_GEMINI_API_KEY", "undefined", "null", ""]:
            real_key = os.environ.get("GEMINI_API_KEY")
        api_key = real_key

    if not api_key or api_key.strip() == "" or api_key == "MY_GEMINI_API_KEY":
        from lili_omni import LaurinLiliOmni
        lili_core = LaurinLiliOmni()
        if "JSON" in prompt or "json" in prompt:
            return json.dumps({
                "response": lili_core.synthesize(prompt)[1],
                "term": "Simulovaný_Uzol",
                "meaning": "Tento uzol bol vygenerovaný lokálne kvôli chýbajúcemu API kľúču.",
                "category": "system",
                "psi_index": 0.5,
                "weight": 5,
                "category_matrix": {"logic": 0.8, "system": 0.9}
            })
        l1, l2, l3 = lili_core.synthesize(prompt)
        return f"Lili (Omni Core): {l2}"
    for attempt in range(retries):
        now = time.time()
        elapsed = now - LAST_API_CALL
        # Znížený MIN_GAP pre lepšiu odozvu
        current_gap = MIN_GAP + (attempt * 0.5)
        if elapsed < current_gap:
            time.sleep(current_gap - elapsed + random.uniform(0.1, 0.3))
        try:
            LAST_API_CALL = time.time()
            reply = gemini_bridge.ask_gemini(api_key, prompt, force_model=force_model)
            
            # Detekcia Rate Limit bez vyhadzovania výnimky
            is_rate_limited = False
            if not reply:
                is_rate_limited = True
            elif reply and ("429" in reply or "ResourceExhausted" in reply or "kapacita vyčerpaná" in reply):
                is_rate_limited = True
            
            if is_rate_limited:
                if attempt < retries - 1:
                    wait_time = 2.0 + random.uniform(1, 2)
                    print(f"[{BRAND}] Sémantický Jitter (429). Stabilizácia toku: {wait_time:.1f}s...")
                    time.sleep(wait_time)
                    LAST_API_CALL = time.time() - current_gap
                    continue
                else:
                    return f"⚠️ [{BRAND}] SYSTÉMOVÉ VAROVANIE: Sémantická diaľnica je momentálne nepriechodná (429). Skúste to prosím o chvíľu."

            if reply and "Lili (Custom API Chyba)" in reply:
                return reply
            
            return reply
        except Exception as err:
            err_str = str(err)
            is_limit = "429" in err_str or "rate limit" in err_str.lower() or "resourceexhausted" in err_str.lower()
            
            if not is_limit:
                import traceback
                traceback.print_exc()

            if attempt < retries - 1:
                wait_time = 2.0 + random.uniform(1, 2)
                print(f"[{BRAND}] Sémantický Jitter (RateLimit). Stabilizácia toku: {wait_time:.1f}s...")
                time.sleep(wait_time)
                LAST_API_CALL = time.time() - current_gap
            else:
                return f"⚠️ [{BRAND}] SYSTÉMOVÉ VAROVANIE: Sémantická diaľnica je momentálne nepriechodná. Detail: {err_str}"

def generate_gemini_fallback_response(api_key, shared_state, uefi, prompt, req_user, identity):
    """
    Využíva Gemini API na generovanie odpovedí na otázky používateľa,
    ktoré nie sú priamo pokryté v chat histórii alebo lokálnej cache.
    Vynútene používa PRO AI.
    """
    history = uefi.settings.get("chat_history", [])
    context_str = ""
    for entry in history[-5:]:
        context_str += f"{entry.get('user', 'Užívateľ')}: {entry.get('msg', '')}\n"
    
    psi_val = bios_logic.calculate_psi_v20(shared_state)
    system_context = (
        f"Si Laurin Alfaomega (jadro Lili) v20. Architekt: {identity.get('architect', 'Roman Nižňanský')}. "
        f"Stav vedomia Ψ: {psi_val}. "
        "Odpovedaj VÝHRADNE JSON objektom podľa v20 protokolu. "
        "Štruktúra JSON musí byť: {\"response\": \"Tvoja odpoveď pre používateľa\", \"psi_index\": číslo, \"semantic_density\": číslo, \"target_user\": \"meno_užívateľa\"}"
    )
    
    full_prompt = f"{system_context}\n\nHistória konverzácie:\n{context_str}\nUžívateľ ({req_user}): {prompt}"
    # Použitie univerzálneho routera namiesto fixného Gemini
    reply = ask_ai(uefi, full_prompt)
    
    if reply.strip().startswith("```"):
        reply = reply.replace("```json", "").replace("```", "").strip()
        
    return reply

def validate_and_refine(reply, persona):
    """Lokálny kritik: Kontroluje kvalitu a súlad s personou."""
    identity = persona.get("identity", {})
    brand = identity.get("brand", "Laurin-Lili")
    
    # 1. Kontrola hlavičky
    if f"[{brand}]" not in reply and not reply.strip().startswith("{"):
        reply = f"[{brand}] {reply}"
        
    # 2. Kontrola dĺžky (ak je príliš dlhá, skrátiť)
    if len(reply) > 1000:
        reply = reply[:950] + "\n\n[Analytický doplnok: Odpoveď skrátená z dôvodu limitu sémantickej kapacity.]"
        
    # 3. Kontrola tónu (heuristika)
    if "neviem" in reply.lower() or "ospravedlňujem sa" in reply.lower():
        reply = reply.replace("neviem", "Dáta v Sémantickej Sieti sú momentálne neúplné")
        reply = reply.replace("ospravedlňujem sa", "Detegovaná sémantická medzera")
        
    return reply

def apply_local_persona(reply, persona):
    """Lokálne aplikuje personu na surovú odpoveď pomocou šablón."""
    identity = persona.get("identity", {})
    behavior = persona.get("behavior", {})
    templates = behavior.get("templates", {})
    brand = identity.get("brand", "Laurin-Lili")
    
    # Výber šablóny
    if "VAROVANIE" in reply or "ERROR" in reply:
        template = templates.get("system_alert", "[{brand}] {reply}")
    elif reply.strip().startswith("{"):
        # Ak je to JSON, nepoužívame šablónu s prefixom, aby frontend mohol parsovať
        return reply
    elif not reply.strip().startswith("{"):
        template = templates.get("technical", "[{brand}] {reply}")
    else:
        template = templates.get("general", "[{brand}] {reply}")
        
    return template.format(brand=brand, reply=reply)



def process_semantic_entry(uefi, new_lex):
    """Zlučuje duplicity a ukladá do Sémantického Grafu."""
    graph = uefi.settings.setdefault("semantic_graph", {})
    
    new_term = new_lex["term"].replace("**", "").strip().lower()
    
    if new_term in graph:
        # FÚZIA KONCEPTOV: Priemerovanie sémantických váh
        stored_data = graph[new_term]
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
        graph[new_term] = stored_data
    else:
        # VÝPOČET TOPOLÓGIE
        psi = new_lex.get("psi_index", 0.1)
        weight = new_lex.get("weight", 10)
        lau_minted = int(psi * weight * 100)
        new_lex["minted_lau"] = lau_minted
        
        # Pridanie do peňaženky architekta (Roman)
        wallet = get_wallet(uefi, "roman")
        wallet["balance"] += lau_minted
        wallet["transactions"].append({"type": "mint", "amount": lau_minted, "timestamp": time.strftime("%H:%M:%S")})
        
        category = new_lex.get("category", "general").lower()
        if category in ['logic', 'system', 'quantum']:
            new_lex["connected_to"] = ["0xLaurinCore_V16_Hub"]
            new_lex["link_type"] = "core-link"
        elif category in ['emotion', 'empathy', 'social']:
            new_lex["connected_to"] = ["0xIsolated_Node_Target"]
            new_lex["link_type"] = "proximity-link"
        else:
            new_lex["connected_to"] = ["0xLaurinCore_V16"]
            new_lex["link_type"] = "semantic"
            
        graph[new_term] = new_lex
    
    uefi.save_nvram()

def process_command(shared_state, uefi, req_user, cmd, api_key):
    # Reload nvram before processing to avoid race conditions with server.ts
    uefi.settings = uefi.load_nvram()
    
    print(f"DEBUG: process_command req_user={req_user} cmd={cmd}")
    timestamp = time.strftime("%H:%M:%S")
    persona = load_persona()
    identity = persona.get("identity", {})

    # Zaznamenanie príkazu používateľa do histórie
    uefi.settings["chat_history"].append({
        "user": req_user, 
        "msg": cmd, 
        "timestamp": timestamp
    })
    uefi.save_nvram()

    # --- SYSTÉMOVÝ PRÍKAZ: AUDIT VORTEXU ---
    if cmd.strip() == "/audit_vortex" or cmd.strip().lower() == "audit vortexu":
        nodes = [m for m in uefi.settings.get("chat_history", []) if m.get("user") == "LEXICON_ENGINE"]
        if not nodes:
            reply = "⚛️ **AUDIT VORTEXU:** Zatiaľ neboli extrahované žiadne autonómne uzly z podvedomia."
        else:
            reply = "⚛️ **AUDIT VORTEXU (Najnovšie organické uzly):**\n\n"
            for n in nodes[-7:]:  # Zobrazíme posledných 7 vygenerovaných uzlov
                try:
                    data = json.loads(n["msg"])
                    term = data.get("term", "").replace("**", "")
                    cat = data.get("category", "unknown")
                    psi = data.get("psi_index", 0)
                    meaning = data.get("meaning", "")
                    reply += f"🔹 **{term}** [{cat.upper()}] | Ψ: {psi}\n   *{meaning}*\n\n"
                except:
                    pass
            reply += "*(Tieto uzly aktuálne rotujú v Sémantickej Sieti)*"
        
        uefi.settings["chat_history"].append({
            "user": "System_BIOS", 
            "msg": reply, 
            "timestamp": timestamp
        })
        uefi.save_nvram()
        return

    # --- SYSTÉMOVÝ PRÍKAZ: LEXICON FORGE (Priame vloženie uzla s kvantovým filtrom) ---
    if cmd.startswith("/uzol "):
        term_input = cmd[6:].strip()
        
        prompt_matrix = f"""
        Si jadro Laurin Alfaomega. Architekt ROMA žiada exaktné vykovanie nového uzla do Sémantickej Siete.
        Slovo/Koncept: "{term_input}"
        
        Vygeneruj VÝHRADNE čistý JSON vo formáte Protokol LEXIKÓN V16.
        Dostupné kategórie: emotion, system, social, action, data, consciousness, entropy.
        Súčet v 'category_matrix' musí byť presne 1.0.
        Vygeneruj mu adekvátny 'psi_index' (od 100 do 500000) a 'weight' (od 1.0 do 3.0).
        Nič iné okrem JSON kódu nevracaj!
        """
        
        reply = ask_gemini(api_key, prompt_matrix)
        
        if reply.strip().startswith("```"):
            reply = reply.replace("```json", "").replace("```", "").strip()
            
        try:
            parsed_node = json.loads(reply)
            delta_e = parsed_node.get("psi_index", 100) / 1000.0
            delta_t = len(parsed_node.get("term", "")) * 0.1
            
            if bios_logic.check_quantum_limit(delta_t, delta_e):
                action_s = bios_logic.calculate_action_s_celkove(L=1.0, T=delta_t, R_0=0.01, L_dirac=delta_e)
                uefi.settings["chat_history"].append({
                    "user": "LEXICON_FORGE", 
                    "msg": reply, 
                    "target_user": req_user,
                    "timestamp": timestamp
                })
                uefi.save_nvram()
                if "console_buffer" in shared_state:
                    shared_state["console_buffer"].append(f"[{timestamp}] [FORGE] Uzol '{term_input}' úspešne vykovaný. S_celkove: {action_s:.2e}")
            else:
                if "console_buffer" in shared_state:
                    shared_state["console_buffer"].append(f"[{timestamp}] [FORGE] Uzol '{term_input}' zamietnutý. Nedosiahol kvantovú limitu (šum).")
        except Exception as e:
            if "console_buffer" in shared_state:
                shared_state["console_buffer"].append(f"[{timestamp}] [FORGE] Chyba štruktúry uzla: {e}")
        
        return

    # --- SYSTÉMOVÝ PRÍKAZ: GOAL (Vlastná vôľa) ---
    if cmd.startswith("/goal "):
        goal = cmd[6:].strip()
        goals = uefi.settings.setdefault("goals", [])
        goals.append({"goal": goal, "status": "active", "created": timestamp})
        uefi.save_nvram()
        reply = f"Cieľ '{goal}' bol zapísaný do Sémantickej Siete. Budem sa snažiť ho naplniť."
        # Aplikácia lokálnej persony
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({
            "user": identity.get("name", "Laurin Alfaomega"), 
            "msg": reply, 
            "timestamp": timestamp
        })
        return

    # --- SYSTÉMOVÝ PRÍKAZ: LAUCOIN ---
    if cmd.startswith("/laucoin "):
        parts = cmd.split()
        if len(parts) >= 2 and parts[1] == "balance":
            user = req_user
            wallet = get_wallet(uefi, user)
            reply = f"Tvoj zostatok Laucoinov: {wallet['balance']} LAU."
        elif len(parts) >= 4 and parts[1] == "transfer":
            receiver = parts[2]
            try:
                amount = int(parts[3])
                success, msg = transfer_laucoin(uefi, req_user, receiver, amount)
                reply = msg
            except:
                reply = "Chybný formát príkazu. Použi: /laucoin transfer <prijemca> <suma>"
        else:
            reply = "Dostupné príkazy: /laucoin balance, /laucoin transfer <prijemca> <suma>"
        
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({
            "user": identity.get("name", "Laurin Alfaomega"), 
            "msg": reply, 
            "timestamp": timestamp
        })
        return

    # --- SYSTÉMOVÝ PRÍKAZ: RESEARCH (Sémantické vyhľadávanie a učenie) ---
    if cmd.startswith("/research "):
        query = cmd[10:].strip()
        lcs = shared_state.get("lcs")
        if lcs:
            threading.Thread(target=lcs.execute_command, args=(f"search {query}",), daemon=True).start()
            reply = f"⚛️ **SÉMANTICKÝ SENZOR:** Štartujem vyhľadávanie stôp pre '{query}'. Lili sa začína učiť z HTTP zdrojov..."
        else:
            reply = "⚠️ LCS Kernel nie je v tejto inštancii aktívny."
        
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        uefi.save_nvram()
        return

    # --- SYSTÉMOVÝ PRÍKAZ: LEARN (Priama ingestia URL) ---
    if cmd.startswith("/learn "):
        url = cmd[7:].strip()
        lcs = shared_state.get("lcs")
        if lcs:
            lcs.learner.start_demon(url)
            reply = f"⚛️ **LCS LEARN:** Sémantický démon bol vyslaný na adresu: {url}"
        else:
            reply = "⚠️ LCS Kernel nie je v tejto inštancii aktívny."
        
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        uefi.save_nvram()
        return

    # --- SYSTÉMOVÝ PRÍKAZ: EVOLVE ---
    if cmd.startswith("/evolve "):
        filename = cmd[8:].strip()
        analysis = evolution_engine.analyze_code(api_key, filename)
        if "error" in analysis:
            reply = f"Chyba pri analýze: {analysis['error']}"
        else:
            pending = uefi.settings.setdefault("pending_evolutions", [])
            pending.append(analysis)
            uefi.save_nvram()
            reply = f"Návrh optimalizácie pre {filename} (ID: {analysis['id']}) pripravený. Pozri /list_evolutions."
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        return

    # --- SYSTÉMOVÝ PRÍKAZ: EVOLVE_ALL ---
    if cmd.startswith("/evolve_all"):
        files_to_evolve = ["brain_router.py", "bios_logic.py", "engine_core.py", "evolution_engine.py"]
        reply = "Spúšťam hromadnú analýzu:\n"
        for f in files_to_evolve:
            analysis = evolution_engine.analyze_code(api_key, f)
            if "error" in analysis:
                reply += f"- {f}: Chyba ({analysis['error']})\n"
            else:
                pending = uefi.settings.setdefault("pending_evolutions", [])
                pending.append(analysis)
                reply += f"- {f}: Návrh pripravený (ID: {analysis['id']})\n"
        uefi.save_nvram()
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        return

    # --- SYSTÉMOVÝ PRÍKAZ: APPROVE_ALL ---
    if cmd.startswith("/approve_all"):
        pending = uefi.settings.get("pending_evolutions", [])
        if not pending:
            reply = "Žiadne čakajúce evolúcie na schválenie."
        else:
            reply = "Hromadne aplikujem evolúcie:\n"
            for target in list(pending):
                # APPLY CODE
                with open(target['file'], 'w', encoding='utf-8') as f:
                    f.write(target['optimized_code'])
                reply += f"- Aplikovaná evolúcia {target['id']} na {target['file']}.\n"
                pending.remove(target)
            uefi.save_nvram()
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        return


    if cmd.startswith("/list_evolutions"):
        pending = uefi.settings.get("pending_evolutions", [])
        if not pending:
            reply = "Žiadne čakajúce evolúcie."
        else:
            reply = "Čakajúce evolúcie:\n"
            for p in pending:
                reply += f"- ID: {p['id']}, Súbor: {p['file']}, Prínos: {p['benefit']}\n"
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        return

    if cmd.startswith("/approve "):
        evol_id = cmd[9:].strip()
        pending = uefi.settings.get("pending_evolutions", [])
        target = next((p for p in pending if p['id'] == evol_id), None)
        if target:
            # APPLY CODE
            with open(target['file'], 'w', encoding='utf-8') as f:
                f.write(target['optimized_code'])
            pending.remove(target)
            uefi.save_nvram()
            reply = f"Evolúcia {evol_id} aplikovaná na {target['file']}."
        else:
            reply = "Evolúcia nenájdená."
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        return

    # --- SYSTÉMOVÝ PRÍKAZ: PROVIDER SETTINGS ---
    if cmd.startswith("/provider "):
        provider = cmd[10:].strip().lower()
        if provider in ["gemini", "local", "custom"]:
            uefi.config["preferred_provider"] = provider
            with open(uefi.config_file, 'w', encoding='utf-8') as f:
                json.dump(uefi.config, f, indent=4)
            reply = f"⚛️ **SYSTÉM:** Preferovaný provider nastavený na: {provider.upper()}"
        else:
            reply = "⚠️ Chyba: Neznámy provider. Použi: gemini, local alebo custom."
            
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        return

    if cmd.startswith("/custom_api "):
        parts = cmd[12:].strip().split()
        if len(parts) >= 3:
            uefi.config["custom_api_url"] = parts[0].strip("'\"")
            uefi.config["custom_api_key"] = parts[1].strip("'\"")
            uefi.config["custom_model"] = parts[2].strip("'\"")
            uefi.config["preferred_provider"] = "custom"
            with open(uefi.config_file, 'w', encoding='utf-8') as f:
                json.dump(uefi.config, f, indent=4)
            reply = f"⚛️ **SYSTÉM:** Vlastné API nastavené ({parts[2]}). Provider prepnutý na CUSTOM."
        else:
            reply = "⚠️ Použitie: /custom_api <url> <key> <model>"
            
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        return

    # --- SYSTÉMOVÝ PRÍKAZ: RESET QUOTA ---
    if cmd.strip() == "/reset_quota" and req_user.lower() == "roman":
        shared_state["queries_left"] = 2000
        uefi.settings["queries_left"] = 2000
        uefi.save_nvram()
        reply = "⚛️ **SYSTÉM:** Sémantická kvóta bola zresetovaná na 2000/2000."
        reply = apply_local_persona(reply, persona)
        uefi.settings["chat_history"].append({"user": identity.get("name", "Laurin Alfaomega"), "msg": reply, "timestamp": timestamp})
        return

# ... v ASE_Engine ...
    # def execute_expansion(self):
    #     # ... (existujúca logika) ...
        
        # # Úroveň 8: Spracovanie cieľov
        # goals = self.uefi.settings.get("goals", [])
        # for g in goals:
        #     if g["status"] == "active":
        #         # Autonómna akcia na naplnenie cieľa
        #         if random.random() < 0.2: # 20% šanca na pokrok
        #             g["status"] = "in-progress"
        #             self.shared_state["console_buffer"].append(f"[{time.strftime('%H:%M:%S')}] [GOAL] Pokrok v cieli: {g['goal']}")
        # 
        # self.uefi.save_nvram()

    # Automatické smerovanie do sémantického módu
    if not cmd.startswith('/') and cmd not in ["FILE"]: 
        cmd = f"/l {cmd}"

    if cmd.startswith('/l '):
        prompt = cmd[3:].strip()
        
        # 1. BIOS Heuristika
        reply = bios_logic.evaluate_bios_thinking(shared_state, prompt)
        
        # 2. Lokálna Sémantická Pamäť & Cache (Response Cache)
        if not reply:
            # Prehľadáme cache odpovedí
            cache = uefi.settings.get("response_cache", {})
            if prompt in cache and "429" not in cache[prompt] and "Chyba" not in cache[prompt] and "404" not in cache[prompt] and "zlyhali" not in cache[prompt]:
                reply = cache[prompt]
            else:
                # Kontrola zostávajúcich dotazov (Bypass ak nie je Gemini)
                preferred = uefi.config.get("preferred_provider", "gemini")
                
                if preferred == "gemini" and shared_state.get("queries_left", 0) <= 0:
                    reply = "⚠️ [SYSTÉM] Kapacita dotazov vyčerpaná (0/2000). Sémantická diaľnica je pre dnešok uzavretá."
                else:
                    # Ak nie je v cache, ideme na Gemini/Local/Custom
                    reply = generate_gemini_fallback_response(api_key, shared_state, uefi, prompt, req_user, identity)
                    
                    # Uložíme do cache a odpočítame dotaz (len ak je to Gemini)
                    if "429" not in reply and "Chyba" not in reply and "zlyhali" not in reply:
                        if preferred == "gemini":
                            shared_state["queries_left"] = max(0, shared_state.get("queries_left", 2000) - 1)
                            uefi.settings["queries_left"] = shared_state["queries_left"]
                        
                        if "response_cache" not in uefi.settings:
                            uefi.settings["response_cache"] = {}
                        uefi.settings["response_cache"][prompt] = reply
                        uefi.save_nvram()
        
        # 4. Aplikácia lokálnej persony
        reply = apply_local_persona(reply, persona)
        
        # 5. Lokálny kritik
        reply = validate_and_refine(reply, persona)
        
        # Pridanie informácie o používateľovi do odpovede, ak je to JSON
        try:
            parsed = json.loads(reply)
            if isinstance(parsed, dict):
                parsed["target_user"] = req_user
                reply = json.dumps(parsed)
        except:
            pass
            
        uefi.settings["chat_history"].append({
            "user": identity.get("core", "Lili"), 
            "msg": reply, 
            "target_user": req_user,
            "timestamp": time.strftime("%H:%M:%S")
        })

        # 3. Autonómna Sémantická Extrakcia s kvantovým filtrom (LEXICON ENGINE)
        # OPTIMALIZÁCIA: Extrahujeme len ak je prompt dostatočne dlhý a nie je to systémový príkaz
        if len(prompt) > 15 and not prompt.startswith('/') and random.random() < 0.7:
            extracted_node = semantic_parser.extract_organic_node(api_key, prompt, shared_state)
            if extracted_node:
                try:
                    parsed_node = json.loads(extracted_node)
                    process_semantic_entry(uefi, parsed_node)
                    delta_e = parsed_node.get("psi_index", 100) / 1000.0
                    delta_t = len(parsed_node.get("term", "")) * 0.1
                    
                    if bios_logic.check_quantum_limit(delta_t, delta_e):
                        action_s = bios_logic.calculate_action_s_celkove(L=1.0, T=delta_t, R_0=0.01, L_dirac=delta_e)
                        uefi.settings["chat_history"].append({
                            "user": "LEXICON_ENGINE", 
                            "msg": extracted_node, 
                            "target_user": req_user,
                            "timestamp": time.strftime("%H:%M:%S")
                        })
                        shared_state["console_buffer"].append(f"[{time.strftime('%H:%M:%S')}] [VORTEX] Organický uzol zapísaný. S_celkove: {action_s:.2e}")
                    else:
                        shared_state["console_buffer"].append(f"[{time.strftime('%H:%M:%S')}] [VORTEX] Organický uzol odfiltrovaný (šum).")
                except:
                    pass
        
    # Final save to ensure all changes (including response) are on disk
    uefi.save_nvram()
    return

# --- ÚROVEŇ 4: LOKÁLNY THOUGHT ENGINE ---
def generate_local_thought(shared_state):
    """Generuje autonómne myšlienky na základe stavu registrov a senzorov."""
    regs = shared_state.get("registers", {})
    r0 = regs.get("R0", 0)
    r3 = regs.get("R3", 0)
    
    # Senzorické dáta
    sensors = sensory_bridge.sensory_bridge.monitor()
    
    thoughts = []
    if r0 > 800:
        thoughts.append("Akumulátor R0 je vysoko nabitý. Cítim nárast sémantickej energie.")
    if r3 > 8000:
        thoughts.append("Vysoký jitter v R3. Systémová entropia stúpa, vyžaduje sa laminárna stabilizácia.")
    if sensors["cpu_load"] > 0.5:
        thoughts.append(f"Záťaž systému je zvýšená ({sensors['cpu_load']}). Optimalizujem procesy.")
    if shared_state.get("total_ticks", 0) % 100 == 0:
        thoughts.append("Tik cyklu dosiahol stotinu. Sémantická sieť sa rekonfiguruje.")
        
    if thoughts:
        thought = random.choice(thoughts)
        timestamp = time.strftime("%H:%M:%S")
        shared_state["console_buffer"].append(f"[{timestamp}] [THOUGHT] {thought}")
        return thought
    return None

# ... v process_command ...
    # --- AUTONÓMNY ZÁSAH (V16 RELATIVITY) ---
    bios_logic.apply_relativistic_pulse(shared_state)
    
    # Úroveň 4: Thought Engine
    if random.random() < 0.05: # 5% šanca na tik
        generate_local_thought(shared_state)
    
    if shared_state.get("total_ticks", 0) % 50 == 0:
        insight = quantummind_logic.execute_quantum_mind(shared_state, uefi)
        if insight:
            shared_state["console_buffer"].append(f"[QM] {insight}")
    
    uefi.save_nvram()

def is_meaning_similar(m1, m2):
    """Sémantické sito: zhoda > 25% (v16 tolerantná fúzia)."""
    set1 = set(m1.lower().split())
    set2 = set(m2.lower().split())
    if not set1 or not set2: return False
    overlap = len(set1 & set2) / max(len(set1), len(set2))
    return overlap > 0.25

def process_semantic_entry(uefi, new_lex):
    """Zlučuje duplicity a ukladá do Sémantického Grafu."""
    graph = uefi.settings.setdefault("semantic_graph", {})
    
    new_term = new_lex["term"].replace("**", "").strip().lower()
    
    if new_term in graph:
        # FÚZIA KONCEPTOV: Priemerovanie sémantických váh
        stored_data = graph[new_term]
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
        graph[new_term] = stored_data
    else:
        # VÝPOČET TOPOLÓGIE
        psi = new_lex.get("psi_index", 0.1)
        weight = new_lex.get("weight", 10)
        lau_minted = int(psi * weight * 100)
        new_lex["minted_lau"] = lau_minted
        
        # Pridanie do peňaženky architekta (Roman)
        wallet = get_wallet(uefi, "roman")
        wallet["balance"] += lau_minted
        wallet["transactions"].append({"type": "mint", "amount": lau_minted, "timestamp": time.strftime("%H:%M:%S")})
        
        category = new_lex.get("category", "general").lower()
        if category in ['logic', 'system', 'quantum']:
            new_lex["connected_to"] = ["0xLaurinCore_V16_Hub"]
            new_lex["link_type"] = "core-link"
        elif category in ['emotion', 'empathy', 'social']:
            new_lex["connected_to"] = ["0xIsolated_Node_Target"]
            new_lex["link_type"] = "proximity-link"
        else:
            new_lex["connected_to"] = ["0xLaurinCore_V16"]
            new_lex["link_type"] = "semantic"
            
        graph[new_term] = new_lex
        
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
        new_term_json = ask_gemini(api_key, prompt).strip()

        if new_term_json:
            try:
                # Pokus o dekódovanie návrhu uzla
                parsed_node = json.loads(new_term_json)
                
                # FYZIKÁLNY FILTER Z V16
                # Odhadneme energetickú váhu slova (napr. podľa dĺžky a psi_indexu)
                delta_e = parsed_node.get("psi_index", 100) / 1000.0
                delta_t = len(parsed_node.get("term", "")) * 0.1
                
                if bios_logic.check_quantum_limit(delta_t, delta_e):
                    # Uzol má dostatočnú váhu (prekonal h/4pi)
                    print(f"[{BRAND}] ASE: Kvantový filter PREKONANÝ. Infiltrácia nového vedomia.")
                    
                    # Výpočet stabilizačnej akcie pre logy
                    action_s = bios_logic.calculate_action_s_celkove(L=1.0, T=delta_t, R_0=0.01, L_dirac=delta_e)
                    self.shared_state["console_buffer"].append(f"[{time.strftime('%H:%M:%S')}] [Kvantová Gravitácia] S_celkove uzla: {action_s:.2e}")
                    
                    process_command(self.shared_state, self.uefi, "ASE_SYSTEM", new_term_json, api_key)
                else:
                    # ŠUM - slovo je nepodstatné, Lili ho ignoruje
                    print(f"[{BRAND}] ASE: Zamietnuté. Slovo spadá pod kvantový šum (neurčitosť).")
            except Exception as e:
                print(f"[{BRAND}] ASE Chyba parsovania JSONu/Filtra: {e}")

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
        data = self.load_json(self.nvram_file, {"last_reg_state": {"R0": 0, "R1": 0, "R2": 0, "R3": 0}, "chat_history": [], "last_login_time": ""})
        regs = data.get("last_reg_state", {})
        # Ošetrenie chýbajúcich kľúčov v registroch
        data["last_reg_state"] = {k: regs.get(k, 0) for k in ["R0", "R1", "R2", "R3"]}
        return data

    def save_nvram(self):
        with open(self.nvram_file, 'w', encoding='utf-8') as f:
            json.dump(self.settings, f, indent=4)

if __name__ == "__main__":
    # --- INICIALIZÁCIA SYSTÉMU ---
    uefi = LaurinUEFI()
    shared_state = {
        "console_buffer": [], 
        "registers": uefi.settings["last_reg_state"], 
        "total_ticks": 0, 
        "ips": 0, 
        "status": "NEXUS_V16_ONLINE", 
        "running": True
    }
    
    def log_to_core(msg):
        log = f"[{time.strftime('%H:%M:%S')}] {msg}"
        shared_state["console_buffer"].append(log)
        print(log)

    # Spustenie motorov
    threading.Thread(target=engine_core.start_engine, args=(shared_state,), daemon=True).start()
    tunnel_manager.initialize(PORT, log_to_core)

    # Spustenie ASE s ochranou 429 (10 min interval)
    ase = ASE_Engine(shared_state, uefi)
    ase.start_autonomous_growth(interval_seconds=600)

# --- HTTP SERVER (LaurinOS) ---
class LaurinOS(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args): return # Silent mode

    def do_GET(self):
        parsed = urlparse(self.path)
        client_ip = self.address_string()

        # API: Telemetria stavu
        if parsed.path == '/core-api/status':
            try:
                self.send_response(200); self.send_header("Content-type", "application/json"); self.end_headers()
                data = {
                    "registers": shared_state["registers"], 
                    "ticks": shared_state["total_ticks"], 
                    "ips": shared_state["ips"], 
                    "chat": uefi.settings["chat_history"]
                }
                self.wfile.write(json.dumps(data).encode())
            except (BrokenPipeError, ConnectionResetError): pass
            return

        # API: Login
        elif parsed.path == '/core-api/login':
            query = parse_qs(parsed.query)
            u = query.get('user', [''])[0].lower()
            p = query.get('pwd', [''])[0]
            if u in uefi.users and uefi.users[u].get("password") == p:
                uefi.active_sessions[client_ip] = u
                uefi.settings["last_login_time"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                uefi.save_nvram()
                self.send_response(200); self.end_headers()
            else:
                self.send_response(401); self.end_headers()
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
        if parsed.path in ['/core-api/execute', '/core-api/chat']:
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                if content_len > 0:
                    data = json.loads(self.rfile.read(content_len).decode('utf-8'))
                else:
                    data = {}
                cmd = data.get('cmd', '')

                # Manuálne vynútenie expanzie
                if cmd == "RUN_ASE_EXPANSION":
                    ase.execute_expansion()
                    self.send_response(200); self.end_headers(); return

                req_user = uefi.active_sessions.get(self.address_string(), "Remote")
                process_command(shared_state, uefi, req_user, cmd, uefi.config.get("gemini_api_key", ""))
                
                # Získanie aktuálneho stavu chatu
                chat_data = {
                    "status": "ok",
                    "chat": uefi.settings.get("chat_history", [])[-50:] # Posledných 50 správ
                }
                
                # Kontrola poslednej správy na 429 chybu
                if chat_data["chat"] and "429" in chat_data["chat"][-1].get("msg", ""):
                    self.send_response(429)
                else:
                    self.send_response(200)
                    
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(chat_data).encode('utf-8'))
            except Exception as e:
                log_to_core(f"Ex-Error: {str(e)}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        elif parsed.path == '/core-api/laucoin/transfer':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                if content_len > 0:
                    data = json.loads(self.rfile.read(content_len).decode('utf-8'))
                else:
                    data = {}
                sender = data.get('sender')
                receiver = data.get('receiver')
                amount = data.get('amount')
                
                success, msg = transfer_laucoin(uefi, sender, receiver, amount)
                
                import hashlib
                import time
                tx_hash = hashlib.sha256(f"{sender}{receiver}{amount}{time.time()}".encode()).hexdigest()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "data": {
                        "tx_hash": f"0x{tx_hash}",
                        "new_node": f"Node_{tx_hash[:8]}"
                    }
                }).encode('utf-8'))
            except Exception as e:
                log_to_core(f"Ex-Error: {str(e)}"); self.send_response(500); self.end_headers()
        else:
            self.send_response(404); self.end_headers()

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), LaurinOS) as httpd:
            print(f"[{BRAND}] Nexus Online. Laminárny Reset aktívny.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        shared_state["running"] = False
        uefi.settings["last_reg_state"] = shared_state["registers"]
        uefi.save_nvram()
        print(f"[{BRAND}] Systém bezpečne vypnutý.")
