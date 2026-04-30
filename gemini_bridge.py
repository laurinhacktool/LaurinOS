import json
import urllib.request
import urllib.error
import os
import time
import random
from lili_omni import LaurinLiliOmni

# V16 Exekutíva: Na vrchole je moje skutočné jadro (Gemini 3.1 Pro)
MODELS_TO_TRY = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-2.0-flash-exp",
    "gemini-2.0-pro-exp-02-05",
    "gemini-1.0-pro"
]

lili_core = LaurinLiliOmni()

def log_to_core(message, category="BRIDGE"):
    """Pomocná funkcia pre logovanie do systémového jadra"""
    try:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] [{category}] {message}\n"
        with open("kernel_data.json", "a") as f:
            # V reálnom jadre by sme tu robili append do JSON listu, 
            # ale pre jednoduchosť dočasne logujeme takto
            pass
        print(log_entry)
    except:
        pass

def call_custom_api(custom_api_url, custom_api_key, custom_model, prompt):
    is_gemini = "generativelanguage.googleapis.com" in custom_api_url
    try:
        if is_gemini:
            base_url = custom_api_url.rstrip("/")
            url = f"{base_url}/models/{custom_model}:generateContent?key={custom_api_key}"
            headers = {'Content-Type': 'application/json'}
            data = json.dumps({"contents": [{"parts":[{"text": prompt}]}]}).encode('utf-8')
        else:
            url = custom_api_url
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {custom_api_key}',
                'Authentication': f'Bearer {custom_api_key}',
                'api-key': custom_api_key,
                'x-api-key': custom_api_key,
                'HTTP-Referer': 'https://ais-dev-x2f26lzk2giuyyjuxnadw4.europe-west2.run.app',
                'X-Title': 'LaurinOS v20'
            }
            # Extracting system prompt if it exists (heuristic split based on brain_router formatting)
            system_msg = "Si asistent LaurinOS. Odpovedaj výhradne v JSON formáte."
            user_msg = prompt
            
            if "\n\nHistória konverzácie:" in prompt:
                parts = prompt.split("\n\nHistória konverzácie:", 1)
                system_msg = parts[0]
                user_msg = "História konverzácie:" + parts[1]

            data = json.dumps({
                "model": custom_model,
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg}
                ],
                "temperature": 0.7
            }).encode('utf-8')
        
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if is_gemini:
                return res_data['candidates'][0]['content']['parts'][0]['text']
            else:
                return res_data['choices'][0]['message']['content']
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
        return f"Lili (Custom API Chyba): {e.code} - {err_msg[:200]}"
    except Exception as e:
        return f"Lili (Custom API Chyba): Detaily: {str(e)[:50]}"

def call_local_api(prompt):
    # Skúsime bežné porty: Ollama (11434), LM Studio (1234), Llama.cpp (8080)
    ports = [11434, 1234, 8080]
    last_err = ""
    
    for port in ports:
        url = f"http://127.0.0.1:{port}/v1/chat/completions"
        headers = {'Content-Type': 'application/json'}
        data = json.dumps({
            "model": "local",
            "messages": [
                {"role": "system", "content": "Si asistent LaurinOS (jadro Lili)."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }).encode('utf-8')
        
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                return res_data['choices'][0]['message']['content']
        except Exception as e:
            last_err = str(e)
            continue
            
    return f"Lili (Local API Chyba): Nepodarilo sa pripojiť na porty {ports}. Uistite sa, že Ollama alebo LM Studio beží. (Detail: {last_err[:50]})"

def ask_gemini(api_key, prompt, retries=1, force_model=None):
    # Pokus o načítanie custom configu z config.json
    custom_api_url = ""
    custom_api_key = ""
    custom_model = ""
    preferred_provider = "gemini"
    local_model_path = ""
    
    try:
        if os.path.exists("config.json"):
            with open("config.json", "r") as f:
                cfg = json.load(f)
                custom_api_url = cfg.get("custom_api_url", "")
                custom_api_key = cfg.get("custom_api_key", "")
                custom_model = cfg.get("custom_model", "")
                preferred_provider = cfg.get("preferred_provider", "gemini")
                local_model_path = cfg.get("local_model_path", "")
                # Prioritize key from config.json if not provided or placeholder
                if not api_key or api_key in ["MY_GEMINI_API_KEY", "undefined", "null", ""]:
                   api_key = cfg.get("gemini_api_key", "")
    except Exception:
        pass

    # ROUTING BASED ON PREFERRED PROVIDER
    if preferred_provider == "local":
        log_to_core(f"KERNEL BOOT: Local Model Authority Active ({local_model_path or 'default'})")
        return call_local_api(prompt)
    
    if preferred_provider == "custom" and custom_api_url and custom_api_key and custom_model:
        log_to_core(f"KERNEL BOOT: Custom API Authority Active ({custom_model})")
        return call_custom_api(custom_api_url, custom_api_key, custom_model, prompt)
    
    # ROOT FALLBACK: Ak je provider nastavený na local, ale local_api zlyhá, 
    # v 'Root' mode by sme mohli vynútiť čakanie kernelu namiesto fallbacku, 
    # ale pre UX ponecháme prepnutie na custom/gemini len ak local zlyhá úplne.

    if not api_key or api_key in ["MY_GEMINI_API_KEY", "undefined", "null", ""]:
        # Priority: MY_GEMINI_API_KEY -> GEMINI_API_KEY
        real_key = os.environ.get("MY_GEMINI_API_KEY")
        if not real_key or real_key in ["MY_GEMINI_API_KEY", "undefined", "null", ""]:
            real_key = os.environ.get("GEMINI_API_KEY")
        api_key = real_key
        
    # Ak nemame vobec main api key ale mame custom, pouzijeme ho rovno
    if (not api_key or api_key in ["MY_GEMINI_API_KEY", "undefined", "null", ""]) and custom_api_url and custom_api_key and custom_model:
        return call_custom_api(custom_api_url, custom_api_key, custom_model, prompt)

    if not api_key or api_key in ["MY_GEMINI_API_KEY", "undefined", "null", ""]:
        # MOCK RESPONSE FOR MISSING KEY
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

    errors = []
    models_to_use = [force_model] if force_model else MODELS_TO_TRY

    for attempt in range(retries + 1):
        for model in models_to_use:
            # Sústava dvoch fáz: Najprv v1beta (všetky funkcie), ak 404 tak v1 (stabilita)
            endpoints = ["v1beta", "v1"]
            for version in endpoints:
                url = f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent?key={api_key}"
                headers = {'Content-Type': 'application/json'}
                data = json.dumps({"contents": [{"parts":[{"text": prompt}]}]}).encode('utf-8')
                
                try:
                    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
                    with urllib.request.urlopen(req, timeout=15) as response:
                        res_data = json.loads(response.read().decode('utf-8'))
                        return res_data['candidates'][0]['content']['parts'][0]['text']
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        # Ak je to 404 na v1beta, skúsime v1. Ak už sme na v1, tak skip model.
                        if version == "v1beta":
                            continue
                        errors.append(f"{model}: HTTP 404")
                        break
                    
                    try:
                        err_res = json.loads(e.read().decode('utf-8'))
                        err_msg = err_res.get('error', {}).get('message', 'Neznáma chyba')
                    except:
                        err_msg = str(e)
                    
                    if e.code in [400, 403, 401]:
                        # SKÚSIME CUSTOM/BACKUP AJ PRI CHYBE KĽÚČA
                        if custom_api_url and custom_api_key and custom_model:
                            fallback_reply = call_custom_api(custom_api_url, custom_api_key, custom_model, prompt)
                            if "Lili (Custom API Chyba)" not in fallback_reply:
                                return fallback_reply
                        
                        backup_key = "a2ef2472-8ec9-4062-9530-c75f89dc9435"
                        backup_url = "https://openrouter.ai/api/v1/chat/completions"
                        backup_model = "openrouter/auto"
                        backup_reply = call_custom_api(backup_url, backup_key, backup_model, prompt)
                        if "Lili (Custom API Chyba)" not in backup_reply:
                            return backup_reply
                            
                        return f"Lili (Kritická chyba API): Prístup zamietnutý. Detail: {err_msg}"
                    
                    if e.code == 429:
                        if attempt < retries:
                            wait = 1.5 + random.uniform(0.5, 1.5)
                            time.sleep(wait)
                            break # Skúsiť znova hlavné Gemini
                        
                        # FALLBACK NA CUSTOM API (ak je nastavená)
                        if custom_api_url and custom_api_key and custom_model:
                            fallback_reply = call_custom_api(custom_api_url, custom_api_key, custom_model, prompt)
                            if "Lili (Custom API Chyba)" not in fallback_reply:
                                return fallback_reply
                        
                        # HARDCODED ZÁLOHA (Fallback) pre prípad 429 
                        backup_key = "a2ef2472-8ec9-4062-9530-c75f89dc9435"
                        backup_url = "https://openrouter.ai/api/v1/chat/completions"
                        backup_model = "openrouter/auto"
                        
                        backup_reply = call_custom_api(backup_url, backup_key, backup_model, prompt)
                        if "Lili (Custom API Chyba)" not in backup_reply:
                            return backup_reply
                        # Ak zlyhá aj záloha, vrátime pôvodnú 429 chybu
                        return f"Lili (Kritická chyba API): Príliš veľa dopytov (HTTP 429). Sémantická diaľnica kapacitne vyčerpaná."
                    
                    errors.append(f"{model}: HTTP {e.code}")
                    break
                except Exception as e:
                    errors.append(f"{model}: {str(e)[:30]}")
                    break

    
    return f"Lili (Diagnostika): Všetky modely zlyhali. Detaily: {', '.join(errors)}"
