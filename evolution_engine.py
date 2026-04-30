import json
import os
import uuid
import gemini_bridge

class SelfHealing_Engine:
    def __init__(self, api_key):
        self.api_key = api_key

    def heal(self, error_log, filename):
        if not os.path.exists(filename):
            return {"error": "File not found."}
        
        with open(filename, 'r', encoding='utf-8') as f:
            code = f.read()
            
        prompt = f"""
        Analyze this error in file {filename}:
        Error: {error_log}
        Code: {code}
        Suggest a fix to resolve this error.
        Return ONLY a JSON object:
        {{
            "id": "{uuid.uuid4()}",
            "file": "{filename}",
            "original_code": "...",
            "optimized_code": "...",
            "benefit": "Fix for: {error_log}",
            "risk": "..."
        }}
        """
        
        reply = gemini_bridge.ask_gemini(self.api_key, prompt, force_model="gemini-2.5-flash")
        if reply.strip().startswith("```"):
            reply = reply.replace("```json", "").replace("```", "").strip()
            
        try:
            return json.loads(reply)
        except Exception as e:
            return {"error": f"Failed to parse healing proposal: {e}"}

def analyze_code(api_key, filename):
    if not os.path.exists(filename):
        return {"error": "File not found."}
    
    with open(filename, 'r', encoding='utf-8') as f:
        code = f.read()
        
    prompt = f"""
    Analyze this code from file: {filename}
    Suggest ONE concrete optimization to improve performance or readability.
    Return ONLY a JSON object:
    {{
        "id": "{uuid.uuid4()}",
        "file": "{filename}",
        "original_code": "...",
        "optimized_code": "...",
        "benefit": "...",
        "risk": "..."
    }}
    """
    
    # Using gemini_bridge.ask_gemini
    reply = gemini_bridge.ask_gemini(api_key, prompt, force_model="gemini-2.5-flash")
    
    # Clean up reply
    if reply.strip().startswith("```"):
        reply = reply.replace("```json", "").replace("```", "").strip()
        
    try:
        return json.loads(reply)
    except Exception as e:
        return {"error": f"Failed to parse optimization: {e}"}
