import { db } from "../firebase";
import { collection, writeBatch, doc, getDocs, query, limit } from "firebase/firestore";
import { generateNetwork } from "./networkGenerator";
import { MiningSlot } from "../types";

export async function initializeNetwork() {
  console.log("Starting network initialization...");
  
  // 1. Check if already initialized
  const nodesRef = collection(db, "nodes");
  const q = query(nodesRef, limit(1));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    console.log("Network already initialized. Skipping.");
    return;
  }

  // 2. Initialize Nodes
  console.log("Generating nodes...");
  const { nodes } = await generateNetwork();
  
  // Firestore batch limit is 500
  for (let i = 0; i < nodes.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = nodes.slice(i, i + 400);
    chunk.forEach(node => {
      const nodeRef = doc(db, "nodes", node.address);
      batch.set(nodeRef, {
        id: node.id,
        address: node.address,
        private_key: node.private_key,
        state_hash: node.state_hash,
        balance: node.balance,
        lastClaimed: Date.now()
      });
    });
    await batch.commit();
    console.log(`Committed nodes batch ${i / 400 + 1}`);
  }

  // 3. Initialize Mining Slots
  console.log("Initializing mining slots...");
  const TOTAL_SLOTS = 1000;
  for (let i = 0; i < TOTAL_SLOTS; i += 400) {
    const batch = writeBatch(db);
    const end = Math.min(i + 400, TOTAL_SLOTS);
    for (let j = i; j < end; j++) {
      const slotRef = doc(db, "mining_slots", j.toString());
      const slot: MiningSlot = {
        id: j,
        lastMinedAt: 0,
        cooldownMs: 60000 + Math.random() * 300000, // 1-6 minutes
        potentialReward: 0.001 + Math.random() * 0.05,
        lastResultEmpty: Math.random() > 0.7,
          isGolden: false
      };
      batch.set(slotRef, slot);
    }
    await batch.commit();
    console.log(`Committed mining slots batch ${i / 400 + 1}`);
  }

  console.log("Network initialization complete.");
}
