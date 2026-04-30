import json
import urllib.request
import os

key = "a2ef2472-8ec9-4062-9530-c75f89dc9435"

# Let's try Groq, OpenRouter, SambaNova...
urls = [
    ("https://api.sambanova.ai/v1/chat/completions", "Meta-Llama-3.1-70B-Instruct"),
    ("https://api.sambanova.ai/v1/chat/completions", "Meta-Llama-3.1-8B-Instruct"),
    ("https://openrouter.ai/api/v1/chat/completions", "google/gemini-2.0-flash-exp:free"),
    ("https://api.groq.com/openai/v1/chat/completions", "llama-3.1-8b-instant")
]

prompt = "Hello"

for api_url, model in urls:
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {key}'
    }
    data = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}]
    }).encode('utf-8')
    try:
        req = urllib.request.Request(api_url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            print(f"SUCCESS with {api_url} / {model}: {res_data['choices'][0]['message']['content'][:50]}")
    except Exception as e:
        print(f"FAIL with {api_url} / {model}: {e}")
        try:
            print(e.read().decode('utf-8'))
        except:
            pass

