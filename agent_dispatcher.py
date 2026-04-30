import json
import time

class Agent:
    def __init__(self, name, role):
        self.name = name
        self.role = role

    def process(self, task, context, dispatcher):
        """
        Spracuje úlohu s možnosťou komunikácie cez dispatcher.
        """
        dispatcher.log(self.name, f"Zahájenie spracovania: {task[:50]}")
        
        # Príklad: Ak Analytik narazí na sémantickú nejasnosť, osloví Lexikografa
        if self.role == "analyst" and "význam" in task.lower():
            dispatcher.log(self.name, "Detegovaná sémantická nejasnosť, žiadam o asistenciu Lexikografa.")
            sub_res = dispatcher.dispatch(f"Sémantická analýza: {task}", context)
            dispatcher.log(self.name, f"Lexikograf vrátil: {sub_res[:50]}...")
            return f"[{self.name}] Integrovaný výsledok: {sub_res}"

        return f"[{self.name}] Spracované: {task}"

class AgentDispatcher:
    def __init__(self):
        self.agents = {
            "analyst": Agent("Analytik", "analyst"),
            "lexicographer": Agent("Lexikograf", "lexicographer"),
            "critic": Agent("Kritik", "critic")
        }
        self.comms_log = []

    def log(self, agent_name, message):
        """Umožňuje agentom komunikovať medzikroky späť do dispatchera."""
        entry = {
            "timestamp": time.strftime("%H:%M:%S"),
            "agent": agent_name,
            "message": message
        }
        self.comms_log.append(entry)
        # V reálnom čase môžeme vypisovať do konzoly pre debug
        print(f"DEBUG [AGENT_COMMS]: {agent_name} -> {message}")

    def dispatch(self, task, context):
        self.log("SYSTEM", f"Dispatching task: {task}")
        
        # Rozhodovacia logika (Heuristika)
        target = "critic"
        if any(w in task.lower() for w in ["register", "fyzika", "výpočet"]):
            target = "analyst"
        elif any(w in task.lower() for w in ["slovo", "význam", "uzol", "graf"]):
            target = "lexicographer"
            
        agent = self.agents[target]
        result = agent.process(task, context, self)
        
        return result

dispatcher = AgentDispatcher()
