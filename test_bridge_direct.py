import os
from dotenv import load_dotenv
load_dotenv()
print("ENV KEY:", os.environ.get("GEMINI_API_KEY"))
import gemini_bridge
reply = gemini_bridge.ask_gemini(os.environ.get("GEMINI_API_KEY"), "hello")
print("REPLY:", reply)
