export const getStatusData = async () => {
  try {
    const response = await fetch('/core-api/status', { 
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.status === 429) {
      const error = new Error("Rate limit exceeded (429)");
      (error as any).status = 429;
      throw error;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Log the actual body for debugging if it's not JSON
      const text = await response.text();
      console.error("Non-JSON response body:", text.slice(0, 200));
      throw new Error("Received non-JSON response from server");
    }
    
    return await response.json();
  } catch (error) {
    if ((error as any).status !== 429) {
      console.error("Error fetching status data:", error);
    }
    throw error;
  }
};

import { 
  db, 
  handleFirestoreError, 
  OperationType, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit
} from '../firebase';

// ==========================================
// User Dossiers CRUD
// ==========================================

export interface UserDossier {
  id: string; // usually userId
  displayName?: string;
  email?: string;
  bio?: string;
  reputationScore?: number;
  lauCoinBalance?: number;
  createdAt?: any;
  updatedAt?: any;
}

export const createUserDossier = async (userId: string, data: Partial<UserDossier>) => {
  const path = `dossiers/${userId}`;
  try {
    const docRef = doc(db, 'dossiers', userId);
    await setDoc(docRef, {
      ...data,
      id: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lauCoinBalance: data.lauCoinBalance || 0,
      reputationScore: data.reputationScore || 0,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getUserDossier = async (userId: string): Promise<UserDossier | null> => {
  const path = `dossiers/${userId}`;
  try {
    const docRef = doc(db, 'dossiers', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserDossier;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
};

export const updateUserDossier = async (userId: string, data: Partial<UserDossier>) => {
  const path = `dossiers/${userId}`;
  try {
    const docRef = doc(db, 'dossiers', userId);
    // Use setDoc with merge to act as an update or create
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteUserDossier = async (userId: string) => {
  const path = `dossiers/${userId}`;
  try {
    const docRef = doc(db, 'dossiers', userId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// ==========================================
// LauCoin Ledger CRUD
// ==========================================

export interface LauCoinTransaction {
  id?: string;
  senderId: string;
  receiverId: string;
  amount: number;
  memo: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp?: any;
}

export const createLedgerTransaction = async (data: LauCoinTransaction): Promise<string> => {
  const path = `laucoin_ledger`;
  try {
    const collRef = collection(db, 'laucoin_ledger');
    const newDoc = await addDoc(collRef, {
      ...data,
      timestamp: serverTimestamp()
    });
    return newDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const getLedgerTransaction = async (transactionId: string): Promise<LauCoinTransaction | null> => {
  const path = `laucoin_ledger/${transactionId}`;
  try {
    const docRef = doc(db, 'laucoin_ledger', transactionId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as LauCoinTransaction;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
};

export const getUserTransactions = async (userId: string, limitCount = 50): Promise<LauCoinTransaction[]> => {
  const path = `laucoin_ledger`;
  try {
    const collRef = collection(db, 'laucoin_ledger');
    const qSender = query(collRef, where('senderId', '==', userId), orderBy('timestamp', 'desc'), limit(limitCount));
    const senderSnaps = await getDocs(qSender);
    const qReceiver = query(collRef, where('receiverId', '==', userId), orderBy('timestamp', 'desc'), limit(limitCount));
    const receiverSnaps = await getDocs(qReceiver);

    const transactionsMap = new Map<string, LauCoinTransaction>();
    
    senderSnaps.docs.forEach(docSnap => {
      transactionsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as LauCoinTransaction);
    });
    receiverSnaps.docs.forEach(docSnap => {
      transactionsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as LauCoinTransaction);
    });

    const combined = Array.from(transactionsMap.values());
    combined.sort((a, b) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
      return timeB - timeA;
    });

    return combined.slice(0, limitCount);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
};

export const updateLedgerTransactionStatus = async (transactionId: string, status: 'pending' | 'completed' | 'failed') => {
  const path = `laucoin_ledger/${transactionId}`;
  try {
    const docRef = doc(db, 'laucoin_ledger', transactionId);
    await setDoc(docRef, {
      status,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};
