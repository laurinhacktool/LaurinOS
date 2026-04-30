import json
import os

NVRAM_PATH = 'nvram.json'

if os.path.exists(NVRAM_PATH):
    with open(NVRAM_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Clear response cache if it contains error messages
    if 'response_cache' in data:
        new_cache = {}
        for k, v in data['response_cache'].items():
            if "Prístup zamietnutý" not in v and "API key not valid" not in v and "429" not in v:
                new_cache[k] = v
        data['response_cache'] = new_cache
        print(f"Cleaned response_cache. Remaining entries: {len(new_cache)}")

    # Clear error messages from chat history
    if 'chat_history' in data:
        new_history = []
        for entry in data['chat_history']:
            msg = entry.get('msg', '')
            if "Prístup zamietnutý" not in msg and "API key not valid" not in msg and "429" not in msg:
                new_history.append(entry)
        data['chat_history'] = new_history
        print(f"Cleaned chat_history. Remaining entries: {len(new_history)}")

    with open(NVRAM_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print("nvram.json cleaned successfully.")
else:
    print("nvram.json not found.")
