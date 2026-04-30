import urllib.request
import urllib.error
import json

class TelegramLauDef:
    def __init__(self, token):
        self.token = token
        self.api_url = f"https://api.telegram.org/bot{token}/"

    def update_webapp_url(self, webapp_url):
        data = {
            "menu_button": {
                "type": "web_app",
                "text": "LAURIN C2",
                "web_app": {"url": webapp_url}
            }
        }
        try:
            req = urllib.request.Request(
                self.api_url + "setChatMenuButton",
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req) as response:
                return response.status == 200
        except Exception as e:
            return False

    def broadcast_app_link(self, chat_id, webapp_url):
        data = {
            "chat_id": chat_id,
            "text": "🟢 Lili: Globálna brána v20.26.04.30 je online. Klikni nižšie pre pripojenie do nášho domčeka:",
            "reply_markup": {
                "inline_keyboard": [[
                    {"text": "🚀 SPUSTIŤ LAURIN OS (v20)", "web_app": {"url": webapp_url}}
                ]]
            }
        }
        try:
            req = urllib.request.Request(
                self.api_url + "sendMessage",
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            urllib.request.urlopen(req)
        except Exception as e:
            pass

def initialize(token):
    return TelegramLauDef(token)
