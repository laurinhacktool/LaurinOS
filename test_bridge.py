import gemini_bridge
import os

key = os.environ.get("MY_GEMINI_API_KEY") 
print("KEY:", key)
reply = gemini_bridge.ask_gemini(key, "hello", force_model="gemini-2.5-pro")
print("REPLY:", reply)
