import time
import random

def start_engine(shared_state):
    """
    Hlavný pohon pre LaurinOS v17 (ROMA).
    Beží v samostatnom vlákne a obsluhuje systémové registre.
    """
    # 1. Počiatočná validácia rozhrania
    required_keys = ["console_buffer", "registers", "total_ticks", "ips", "running"]
    for key in required_keys:
        if key not in shared_state:
            # Ak kľúč chýba, inicializujeme ho (prevencia KeyError)
            if key == "console_buffer": shared_state[key] = []
            elif key == "registers": shared_state[key] = {"R0": 0, "R1": 0, "R2": 0, "R3": 0}
            else: shared_state[key] = 0

    log_entry(shared_state, "Engine Core: ROMA kernel načítaný.")
    
    last_tick_time = time.time()
    
    # 2. Hlavná slučka Enginu
    while shared_state.get("running", True):
        current_time = time.time()
        elapsed = current_time - last_tick_time
        
        # Simulácia systémového tiku (cca každú sekundu)
        if elapsed >= 0.0005:
            shared_state["total_ticks"] += 1
            
            # Simulácia IPS (inštrukcie za sekundu) - náhodný pohyb
            shared_state["ips"] = random.randint(1024, 4096)
            
            # Logika spracovania registrov (ROMA Architecture)
            # Každý tik mierne modifikujeme registre, aby rozhranie "žilo"
            update_registers(shared_state["registers"])
            
            # Náhodné systémové hlásenia
            if shared_state["total_ticks"] % 10 == 0:
                log_entry(shared_state, f"Systémová údržba: Registre synchronizované.")
            
            last_tick_time = current_time
            
        # Krátky spánok, aby sme nevyťažili CPU na iPhone 15 Pro na 100%
        time.sleep(0.01)

def update_registers(registers):
    """Simuluje nízkoúrovňovú prácu procesora."""
    # R0 je hlavný akumulátor, R1-R3 sú pomocné
    registers["R0"] = (registers["R0"] + 1) % 1000
    if registers["R0"] % 10 == 0:
        registers["R1"] = random.randint(0, 255)
        registers["R2"] = (registers["R2"] + registers["R1"]) % 512
        registers["R3"] = random.randint(1000, 9999)

def log_entry(shared_state, msg):
    """Bezpečné pridávanie správ do konzolového buffra."""
    timestamp = time.strftime("%H:%M:%S")
    full_msg = f"[{timestamp}] {msg}"
    
    shared_state["console_buffer"].append(full_msg)
    
    # Udržujeme buffer čistý pre plynulé rozhranie (max 50 záznamov)
    if len(shared_state["console_buffer"]) > 50:
        shared_state["console_buffer"].pop(0)
