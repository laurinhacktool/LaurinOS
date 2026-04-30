import json
import urllib.request
import urllib.error

key = "a2ef2472-8ec9-4062-9530-c75f89dc9435"

endpoints = [
    ("Groq", "https://api.groq.com/openai/v1/chat/completions", "llama-3.1-8b-instant"),
    ("Mistral", "https://api.mistral.ai/v1/chat/completions", "mistral-small-latest"),
    ("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", "openrouter/auto"),
    ("HuggingFace", "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions", "mistralai/Mistral-7B-Instruct-v0.3"),
    ("SambaNova", "https://api.sambanova.ai/v1/chat/completions", "Meta-Llama-3.1-8B-Instruct"),
    ("DeepInfra", "https://api.deepinfra.com/v1/openai/chat/completions", "meta-llama/Meta-Llama-3-8B-Instruct"),
    ("Together", "https://api.together.xyz/v1/chat/completions", "meta-llama/Llama-3-8b-chat-hf"),
    ("Perplexity", "https://api.perplexity.ai/chat/completions", "llama-3-sonar-small-32k-online")
]

prompt = "Hello"
system_msg = "test"

for name, url, model in endpoints:
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {key}'
    }
    data = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7
    }).encode('utf-8')
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=5) as response:
            print(f"{name}: SUCCESS -> {response.read().decode('utf-8')[:50]}")
    except urllib.error.HTTPError as e:
        print(f"{name}: {e.code} -> {e.read().decode('utf-8')[:50]}")
    except Exception as e:
        print(f"{name}: ERROR -> {e}")

