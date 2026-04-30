export interface LauNode {
  id: number;
  address: string;
  private_key: string;
  state_hash: string;
  balance: number;
  lastClaimed?: number;
  displayName?: string;
  email?: string;
  isVerified?: boolean;
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  hash: string;
  type: 'transfer' | 'mint' | 'mine' | 'staking';
}

export interface MiningSlot {
  id: number;
  lastMinedAt: number;
  cooldownMs: number;
  potentialReward: number;
  lastMiner?: string;
  lastResultEmpty?: boolean;
  isGolden?: boolean;
}

export interface LauRequest {
  id: string;
  from: string; // The requester
  to: string;   // The person who should pay
  amount: number;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
}

export interface Lease {
  id: string;
  lessor: string; // The one providing the power
  lessee: string | null; // The one using the power (null if available)
  power: number;  // Hashrate multiplier (e.g., 0.5 for 50% boost)
  price: number;  // Cost in LauCoin
  durationMs: number;
  expiresAt: number | null;
  status: 'available' | 'active' | 'expired';
  createdAt: number;
}

export type ApiErrorType = 'RATE_LIMIT' | 'AUTH_ERROR' | 'SAFETY_BLOCK' | 'NETWORK_ERROR' | 'UNKNOWN';

export interface ApiError {
  type: ApiErrorType;
  message: string;
  originalError?: any;
  retryAfter?: number;
}
