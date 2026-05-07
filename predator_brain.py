import json
import os
import re

# [L-CORE_V16.26.0_PREDATOR_OFFENSIVE]
# Sémantické jadro systému Laurin OS v16, špecializovaný modul "PREDATOR.BRAIN" - LOCAL REGEX ENGINE

class PredatorBrain:
    def __init__(self):
        pass

    def analyze(self, raw_data, filename):
        """ Lokálny útok na vnútro kódu bez potreby API. """
        print(f"\n[PREDATOR] Zahajujem lokálny útok na: {filename}")
        
        # Target vzory (RegEx) - naše digitálne senzory
        patterns = {
            "API_URL": r'https?://[a-zA-Z0-9\.\-_/]+',
            "GOOGLE_KEY": r'AIzaSy[A-Za-z0-9_-]{33}',
            "YOUTUBE_CLIENT": r'[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com',
            "INTERNAL_IP": r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
        }

        found_apis = set()
        found_keys = {}

        for label, regex in patterns.items():
            matches = re.findall(regex, str(raw_data))
            if matches:
                for match in set(matches):
                    if label in ["API_URL", "INTERNAL_IP"]:
                        found_apis.add(match)
                    else:
                        found_keys[f"{label}_{len(found_keys)}"] = match

        apis_list = list(found_apis)
        
        log_msg = f"Lokálna analýza {filename} dokončená. Nájdených {len(apis_list)} koncových bodov a {len(found_keys)} kľúčov."

        kernel_snippet = f"""# Okamžitá integrácia pre {filename}
import urllib.request
# Boli detekované tieto ciele:
# {apis_list[:3]}...
"""
        return {
            "log": log_msg,
            "apis": apis_list,
            "keys": found_keys,
            "kernel_code": kernel_snippet
        }

predator_brain = PredatorBrain()
