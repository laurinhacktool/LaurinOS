import json
import gemini_bridge

def extract_organic_node(api_key, prompt, shared_state):
    """
    Analyzuje vstup a extrahuje organický sémantický uzol.
    """
    # Prompt pre extrakciu
    extraction_prompt = (
        f"Analyzuj tento vstup: '{prompt}'. "
        "Ak obsahuje hlboký koncept, extrahuj ho ako nový uzol v JSON formáte: "
        "{'term': 'názov', 'meaning': 'význam', 'category': 'kategória', 'psi_index': 1000}. "
        "Ak koncept neobsahuje, vráť prázdny reťazec."
    )
    
    # Získame extrakciu od jadra
    extracted = gemini_bridge.ask_gemini(api_key, extraction_prompt, force_model="gemini-2.5-flash").strip()
    
    if extracted.startswith("```"):
        extracted = extracted.replace("```json", "").replace("```", "").strip()
        
    if "{" in extracted and "}" in extracted:
        return extracted
    
    return None
