import { LauNode, Transaction } from "../types";

// Simple SHA-256 implementation for the browser environment
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const TOTAL_NODES = 2000;
const VIRTUAL_TOTAL_NODES = 150000000000000; // 150 Trillion
const LIQUIDITY = 314000;
const PI = Math.PI;

// Seeded random number generator
class SeededRandom {
  seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  getRandBits(bits: number) {
    let res = BigInt(0);
    for (let i = 0; i < bits; i += 32) {
      const chunk = Math.floor(this.next() * 0x100000000);
      res = (res << BigInt(32)) | BigInt(chunk);
    }
    return res;
  }
}

export async function generateTransactionHash(from: string, to: string): Promise<string> {
  const [fromHash, toHash] = await Promise.all([sha256(from), sha256(to)]);
  return await sha256(`${fromHash}${toHash}`);
}

export function getSemanticValue(node: LauNode): number {
  if (node.address.startsWith('0xLaurinCore')) {
    // Semantic nodes have high base value
    const themes: Record<string, number> = {
      "LaurinCore_Nexus": 0.8,
      "LaurinCore_Aether": 0.7,
      "LaurinCore_Prism": 0.6,
      "LaurinCore_Void": 0.5,
      "LaurinCore_Zenith": 0.9,
      "LaurinCore_Origin": 1.0,
      "LaurinCore_Pulse": 0.4,
      "LaurinCore_Echo": 0.3,
      "LaurinCore_Flux": 0.4,
      "LaurinCore_V16_Entropy": 0.85,
      "LaurinCore_V16_Singularity": 0.95,
      "LaurinCore_V17_Omniscience": 1.1,
      "LaurinCore_V17_Infinity": 1.2
    };
    return themes[node.displayName || ""] || 0.5;
  }
  
  if (node.address.startsWith('0xLaurinNuance')) {
    return 0.75; // Nuance nodes have high semantic value
  }
  
  if (node.address.startsWith('0xLau96569')) {
    return 1.2; // Admin nodes have highest semantic value
  }

  // Regular nodes have low semantic value based on their address entropy
  const entropy = node.address.length / 42;
  return 0.1 * entropy;
}

export async function generateNetwork(): Promise<{ nodes: LauNode[] }> {
  const rng = new SeededRandom(Math.floor(PI * 1000000));
  const addresses = new Set<string>();

  // 1. Generate raw node data sequentially to keep RNG deterministic
  const rawNodes = [];
  for (let i = 1; i <= TOTAL_NODES; i++) {
    let addr = "";
    while (true) {
      const rawAddr = rng.getRandBits(144).toString(16).padStart(36, '0');
      addr = `0xLau${rawAddr}`;
      if (!addresses.has(addr)) {
        addresses.add(addr);
        break;
      }
    }
    const privKeySeed = rng.next();
    const balance = Math.floor(rng.next() * 1000000) / 100;
    rawNodes.push({ i, addr, privKeySeed, balance });
  }

  // 2. Hash node data in parallel
  const nodes = await Promise.all(rawNodes.map(async ({ i, addr, privKeySeed, balance }) => {
    const [privKeyHash, stateHashValue] = await Promise.all([
      sha256(`${addr}${PI}${privKeySeed}`),
      sha256(`${addr}${PI}${i}`)
    ]);
    return {
      id: i,
      address: addr,
      private_key: `LauPriv_${privKeyHash.slice(0, 48)}`,
      state_hash: `0x${stateHashValue}`,
      balance: balance
    } as LauNode;
  }));

  // 3. Semantic nodes
  const semanticThemes = [
    "LaurinCore_Nexus", "LaurinCore_Aether", "LaurinCore_Prism",
    "LaurinCore_Void", "LaurinCore_Zenith", "LaurinCore_Origin", "LaurinCore_Pulse",
    "LaurinCore_Echo", "LaurinCore_Flux", "LaurinCore_V16_Entropy", "LaurinCore_V16_Singularity",
    "LaurinCore_V17_Omniscience", "LaurinCore_V17_Infinity"
  ];

  const nuanceThemes = [
    "Nuance_V16_Subliminal", "Nuance_V16_Recursive", "Nuance_V17_Transcendent", "Nuance_V17_Infinite_Loop"
  ];

  const semanticPromises = semanticThemes.map(async (theme, i) => {
    const themeHash = await sha256(theme);
    const addr = `0xLaurinCore_${theme.toLowerCase()}_${themeHash.slice(0, 8)}`;
    const stateHashValue = await sha256(`${addr}${PI}semantic`);
    
    const semanticNode: LauNode = {
      id: 0, // Will be re-indexed
      address: addr,
      private_key: `LauPriv_Semantic_${i}`,
      state_hash: `0x${stateHashValue}`,
      balance: 0,
      displayName: theme
    };

    const extraNodes: LauNode[] = [semanticNode];

    if (theme.includes("V16") || theme.includes("V17")) {
      const nuanceTheme = nuanceThemes[i % nuanceThemes.length];
      const nuanceThemeHash = await sha256(nuanceTheme);
      const nuanceAddr = `0xLaurinNuance_${nuanceTheme.toLowerCase()}_${nuanceThemeHash.slice(0, 8)}`;
      const nuanceStateHash = await sha256(nuanceAddr + PI);
      
      extraNodes.push({
        id: 0, // Will be re-indexed
        address: nuanceAddr,
        private_key: `LauPriv_Nuance_${i}`,
        state_hash: `0x${nuanceStateHash}`,
        balance: 0,
        displayName: nuanceTheme
      });
    }
    return extraNodes;
  });

  const semanticResults = await Promise.all(semanticPromises);
  const allNodes = [...nodes, ...semanticResults.flat()];
  
  // Final sequential re-indexing to ensure unique IDs
  allNodes.forEach((node, index) => {
    node.id = index + 1;
  });

  return { nodes: allNodes };
}

export async function generateVirtualNode(address: string): Promise<LauNode> {
  const [hash, virtualStateHash] = await Promise.all([
    sha256(address),
    sha256(address + "virtual")
  ]);
  // Deterministic random balance based on address
  const balance = (parseInt(hash.slice(0, 8), 16) % 1000000) / 100;
  
  return {
    id: -1, // Virtual ID
    address: address,
    private_key: `LauPriv_Virtual_${hash.slice(0, 16)}`,
    state_hash: `0x${virtualStateHash}`,
    balance: balance,
    displayName: `Virtual Node ${address.slice(0, 8)}`
  };
}
