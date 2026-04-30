import { ethers } from 'ethers';

/**
 * Signs a transaction message using a private key.
 * @param privateKey The private key to sign with.
 * @param message The message to sign (usually a JSON string of transaction data).
 * @returns The signature and the public address.
 */
export async function signTransaction(privateKey: string, message: string) {
  try {
    // Ensure private key is in correct format for ethers (0x prefix)
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey.replace('LauPriv_', '')}`;
    
    // If it's still not 64 chars (32 bytes), we might need to pad it or handle it
    // But LauPriv_ seems to be a custom format. Let's see how it's generated in LauCoinApp.tsx
    // line 60: const privHex = Array.from(privBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    // line 61: const privateKey = `LauPriv_${privHex}`;
    // privBytes is 24 bytes (48 chars). Ethers expects 32 bytes (64 chars).
    
    let finalKey = formattedKey;
    if (finalKey.length < 66) {
      finalKey = '0x' + finalKey.replace('0x', '').padStart(64, '0');
    }

    const wallet = new ethers.Wallet(finalKey);
    const signature = await wallet.signMessage(message);
    return {
      signature,
      address: wallet.address,
      publicKey: wallet.signingKey.publicKey
    };
  } catch (error) {
    console.error("Signing error:", error);
    throw error;
  }
}

/**
 * Verifies a signature against a message and address.
 * @param message The original message.
 * @param signature The signature to verify.
 * @param expectedAddress The address that should have signed the message.
 * @returns True if valid.
 */
export function verifySignature(message: string, signature: string, expectedAddress: string) {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error("Verification error:", error);
    return false;
  }
}
