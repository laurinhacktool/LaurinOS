import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';

const bip32 = BIP32Factory(ecc);
const network = bitcoin.networks.testnet;

export const generateBitcoinWallet = async () => {
  const mnemonic = bip39.generateMnemonic();
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, network);
  
  const path = "m/44'/1'/0'/0/0";
  const child = root.derivePath(path);
  
  const { address } = bitcoin.payments.p2pkh({ pubkey: child.publicKey, network });
  
  return {
    mnemonic,
    address: address!,
    privateKey: child.toWIF()
  };
};

export const deriveBitcoinWalletFromMnemonic = async (mnemonic: string, index: number) => {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, network);
  
  // BIP44 path: m/44'/1'/0'/0/index
  const path = `m/44'/1'/0'/0/${index}`;
  const child = root.derivePath(path);
  
  const { address } = bitcoin.payments.p2pkh({ pubkey: child.publicKey, network });
  
  return {
    address: address!,
    privateKey: child.toWIF(),
    index
  };
};

export const getBitcoinBalance = async (address: string): Promise<number> => {
  try {
    const response = await fetch(`https://blockstream.info/testnet/api/address/${address}`);
    const data = await response.json();
    const balanceSatoshis = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    return balanceSatoshis / 100000000; // Convert to BTC
  } catch (error) {
    console.error("Failed to fetch Bitcoin balance:", error);
    return 0;
  }
};
