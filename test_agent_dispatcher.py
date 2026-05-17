import unittest
from agent_dispatcher import AgentDispatcher, Agent

class TestAgentAnalyst(unittest.TestCase):
    def setUp(self):
        self.dispatcher = AgentDispatcher()
        # Vyčistiť logy pred každým testom pre istotu
        self.dispatcher.comms_log = []

    def test_analyst_normal_processing(self):
        """Test the Analyst agent processing a standard task without semantic ambiguity"""
        task = "Preveď fyzikálny výpočet zrýchlenia bez akejkoľvek nejasnosti."
        
        result = self.dispatcher.dispatch(task, {})
        
        # Malo by spracovať bez volania Lexikografa
        self.assertIn("[Analytik] Spracované:", result)
        
        # Skontrolovať logy
        logs = [log["message"] for log in self.dispatcher.comms_log]
        self.assertNotIn("Detegovaná sémantická nejasnosť, žiadam o asistenciu Lexikografa.", logs)
        
    def test_analyst_semantic_ambiguity_delegation(self):
        """Test the Analyst agent detecting semantic ambiguity and requesting Lexicographer assistance"""
        # Úloha obsahujúca spúšťače pre Analytika ("výpočet") a sémantickú nejasnosť ("význam")
        task = "Preveď tento výpočet a vysvetli mi jeho význam."
        
        result = self.dispatcher.dispatch(task, {})
        
        # Analytik by mal vrátiť integrovaný výsledok obsahujúci odpoveď od Lexikografa
        self.assertIn("[Analytik] Integrovaný výsledok:", result)
        self.assertIn("[Lexikograf] Spracované: Sémantická analýza:", result)
        
        # Overenie kominukačných logov
        logs = [log["message"] for log in self.dispatcher.comms_log]
        
        # Analytik odoslal požiadavku
        self.assertIn("Detegovaná sémantická nejasnosť, žiadam o asistenciu Lexikografa.", logs)
        
        # Analytik obdržal odpoveď
        received_response_log = any(log.startswith("Lexikograf vrátil:") for log in logs)
        self.assertTrue(received_response_log, "The Analyst should log that it received a response from Lexicographer.")
        
    def test_analyst_recursive_delegation_safety(self):
        """Ensure that the delegated task to Lexicographer doesn't bounce back infinitely"""
        # Toto zabezpečí, že ak dispečer správne nesmeruje Sémantickú analýzu,
        # náš test by buď padol na Maximum Recursion Depth, alebo v logoch zachytíme chybu.
        # Ak všetko funguje správne, Lexikograf by to mal úspešne spracovať.
        task = "Preveď fyzika výpočet a zisti význam."
        
        result = self.dispatcher.dispatch(task, {})
        
        # Overíme, že vo výsledku je zreťazenie, nie nekonečný loop
        self.assertTrue(result.startswith("[Analytik] Integrovaný výsledok: [Lexikograf] Spracované: Sémantická analýza: Preveď fyzika výpočet a zisti význam."))
       
if __name__ == "__main__":
    unittest.main()
