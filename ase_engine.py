import json
import random
import brain_router
import bios_logic

def run_autoloader(shared_state, uefi, api_key):
    """
    ASE: Vyhľadá sémantické medzery a vloží nový stabilizačný uzol.
    """
    history = uefi.settings.get("chat_history", [])
    existing_terms = []
    
    # Získame všetky existujúce pojmy
    for m in history:
        if '"term":' in m["msg"]:
            try:
                start = m["msg"].find('{')
                end = m["msg"].rfind('}') + 1
                existing_terms.append(json.loads(m["msg"][start:end])["term"])
            except: continue

    if len(existing_terms) < 2: return "ASE: Nedostatok dát pre expanziu."

    # Vyberieme dva náhodné silné uzly pre hľadanie mosta
    pair = random.sample(existing_terms, 2)
    
    # Príkaz pre ASE
    expansion_cmd = (
        f"Na základe symbiózy slov '{pair[0]}' a '{pair[1]}' v systéme v16, "
        "navrhni jedno kľúčové slovo (most), ktoré ich spája. "
        "Odpovedz len týmto slovom."
    )
    
    # Získame návrh od jadra
    new_word = brain_router.gemini_bridge.ask_gemini(api_key, expansion_cmd, force_model="gemini-2.5-flash").strip()
    
    if new_word and new_word not in existing_terms:
        # Automaticky spustíme analýzu nového slova
        brain_router.process_command(shared_state, uefi, "ASE_SYSTEM", new_word, api_key)
        return f"ASE: Infiltrované nové slovo: {new_word} (Most medzi {pair[0]} a {pair[1]})"
    
    return "ASE: Žiadna nová symbióza nenájdená."
