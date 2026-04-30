import os
import time

class SensoryBridge:
    def __init__(self):
        self.last_check = time.time()

    def get_system_load(self):
        # Jednoduchá simulácia zaťaženia systému
        load = os.getloadavg() if hasattr(os, 'getloadavg') else (0.0, 0.0, 0.0)
        return {
            "cpu_load": load[0],
            "memory_usage": "nominal",
            "status": "stable"
        }

    def monitor(self):
        # Monitorovanie v reálnom čase
        data = self.get_system_load()
        return data

sensory_bridge = SensoryBridge()
