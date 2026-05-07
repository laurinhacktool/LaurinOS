import json
import urllib.request
import urllib.error

def ask_ollama(prompt, model="llama3", url="http://localhost:11434"):
    """
    Komunikuje s lokálnou inštanciou Ollama pomocou urllib.
    """
    try:
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        data = json.dumps(payload).encode('utf-8')
        
        req = urllib.request.Request(f"{url}/api/generate", data=data, method='POST')
        req.add_header('Content-Type', 'application/json')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status == 200:
                result = json.loads(response.read().decode('utf-8'))
                return result.get("response", "")
            else:
                return f"⚠️ [Ollama Error] Server vrátil status {response.status}"
            
    except urllib.error.URLError as e:
        if "Connection refused" in str(e) or "111" in str(e):
             return "⚠️ [Ollama Error] Nepodarilo sa pripojiť k lokálnemu serveru (localhost:11434). Je Ollama spustená?"
        return f"⚠️ [Ollama Error] Sieťová chyba: {str(e)}"
    except Exception as e:
        return f"⚠️ [Ollama Error] Neočakávaná chyba: {str(e)}"
