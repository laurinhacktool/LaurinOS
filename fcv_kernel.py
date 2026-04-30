import json
import os
import hashlib
import time
import random

KERNEL_DATA_FILE = "kernel_data.json"

def get_hash(data):
    return hashlib.sha256(data.encode()).hexdigest()

def load_kernel_data():
    if os.path.exists(KERNEL_DATA_FILE):
        with open(KERNEL_DATA_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except:
                return {"nodes": {}, "transactions": []}
    return {"nodes": {}, "transactions": []}

def save_kernel_data(data):
    with open(KERNEL_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

def initialize_kernel(initial_nodes):
    """Inicializuje kernel s počiatočnými uzlami ak súbor neexistuje."""
    if not os.path.exists(KERNEL_DATA_FILE):
        data = {"nodes": {}, "transactions": []}
        for node in initial_nodes:
            addr = node.get("address")
            if addr:
                data["nodes"][addr] = {
                    "address": addr,
                    "private_key": node.get("private_key"),
                    "balance": node.get("balance", 0),
                    "state_hash": node.get("state_hash"),
                    "displayName": node.get("displayName", ""),
                    "semantic_value": node.get("semantic_value", 0.1)
                }
        save_kernel_data(data)
        return True
    return False

def transfer_laucoin(sender_addr, sender_priv_key, receiver_addr, amount, semantic_context="", signature=None, message=None, verified=False, public_key=None):
    data = load_kernel_data()
    nodes = data["nodes"]
    
    if sender_addr not in nodes:
        return False, "Odosielateľ neexistuje v kerneli."
    
    sender_node = nodes[sender_addr]
    
    # Overenie transakcie (Podpis alebo Privátny kľúč)
    if verified:
        # Ak server.ts už overil podpis, dôverujeme mu
        print(f"Kernel: Prijatá OVERENÁ transakcia od {sender_addr}")
    elif signature and message:
        # Tu by sme mohli overiť podpis priamo v Pythone ak by sme mali ecdsa
        # Pre teraz sa spoliehame na verified flag zo server.ts
        return False, "Podpis nebol overený systémom."
    else:
        # Spätná kompatibilita: Overenie privátneho kľúča (heslo)
        if sender_node.get("private_key") != sender_priv_key:
            return False, "Neplatný privátny kľúč alebo chýbajúci podpis."
    
    if sender_node.get("balance", 0) < amount:
        return False, "Nedostatočný zostatok."
    
    if receiver_addr not in nodes:
        # Ak príjemca neexistuje, vytvoríme ho ako nový uzol (automatická expanzia)
        nodes[receiver_addr] = {
            "address": receiver_addr,
            "balance": 0,
            "state_hash": "0x" + get_hash(receiver_addr),
            "semantic_value": 0.1,
            "type": "auto-generated"
        }

    receiver_node = nodes[receiver_addr]
    
    # Aktualizácia zostatkov
    sender_node["balance"] -= amount
    receiver_node["balance"] += amount
    
    # Generovanie nových stavových hashov pre ovplyvnené uzly
    sender_node["state_hash"] = "0x" + get_hash(f"{sender_addr}{sender_node['balance']}{time.time()}")
    receiver_node["state_hash"] = "0x" + get_hash(f"{receiver_addr}{receiver_node['balance']}{time.time()}")
    
    # Záznam transakcie
    tx_hash = "0x" + get_hash(f"{sender_addr}{receiver_addr}{amount}{time.time()}")
    tx = {
        "from": sender_addr,
        "to": receiver_addr,
        "amount": amount,
        "timestamp": time.time(),
        "hash": tx_hash
    }
    data["transactions"].append(tx)
    
    # Vytvorenie nového sémantického uzla (entity)
    # Každým prevodom sa vytvárajú nodes v sieti so semantickou hodnotou
    nuance_id = get_hash(f"{tx_hash}{semantic_context}")[:12]
    new_node_addr = f"0xLaurinNuance_{nuance_id}"
    
    nodes[new_node_addr] = {
        "address": new_node_addr,
        "balance": 0.05, # Malý "dust" pre nový sémantický uzol
        "state_hash": "0x" + get_hash(new_node_addr),
        "semantic_value": 0.8,
        "type": "transaction-nuance",
        "context": semantic_context or f"Transfer from {sender_addr[:10]} to {receiver_addr[:10]}"
    }
    
    save_kernel_data(data)
    return True, {
        "message": "Prevod úspešný.",
        "tx_hash": tx_hash,
        "new_node": new_node_addr
    }

def get_balance(address):
    data = load_kernel_data()
    node = data["nodes"].get(address)
    if node:
        return node.get("balance", 0)
    return 0

def get_all_nodes():
    data = load_kernel_data()
    return list(data["nodes"].values())

def autonomous_semantic_transfer():
    """Simuluje sieťovú aktivitu: Prevod LauCoinov medzi uzlami na základe sémantickej váhy."""
    data = load_kernel_data()
    nodes_list = list(data["nodes"].values())
    if len(nodes_list) < 2: return False, "Nedostatok uzlov."

    # Filtrujeme uzly s nenulovým zostatkom
    senders = [n for n in nodes_list if n.get("balance", 0) > 0.1]
    if not senders: return False, "Žiadni odosielatelia."

    sender = random.choice(senders)
    # Vyberieme príjemcu (nie odosielateľa)
    receivers = [n for n in nodes_list if n["address"] != sender["address"]]
    if not receivers: return False, "Žiadni príjemcovia."
    
    receiver = random.choice(receivers)
    
    # Výpočet sumy na základe sémantickej hodnoty (0.01 až 1.0 LAU)
    semantic_weight = sender.get("semantic_value", 0.1)
    amount = round(random.uniform(0.01, 0.1) * semantic_weight * 10, 4)
    
    if sender["balance"] < amount:
        amount = round(sender["balance"] * 0.1, 4)

    if amount <= 0: return False, "Suma príliš malá."

    # Vykonanie prevodu
    success, res = transfer_laucoin(
        sender["address"], 
        sender.get("private_key"), 
        receiver["address"], 
        amount, 
        semantic_context="Autonomous Semantic Expansion Transfer",
        verified=True # Interný prevod
    )
    
    if success:
        return True, f"Auto-Transfer: {amount} LAU od {sender['address'][:8]} pre {receiver['address'][:8]}"
    return False, res
