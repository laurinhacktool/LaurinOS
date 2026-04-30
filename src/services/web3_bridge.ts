import { ethers } from "ethers";

// Lili v17 Logging Style
const log = (message: string) => {
  console.log(`[Lili v17]: ${message}`);
};

// Simple sanitization for laminar integrity
const sanitizeInput = (input: string): string => {
  return input.replace(/[^a-zA-Z0-9 ]/g, '');
};

// Placeholder contract addresses and ABIs
const LAUCOIN_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace
const LEXICON_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace
const SWAP_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace

const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const LEXICON_ABI = ["function addWordToLexicon(string memory _word)"];
const SWAP_ABI = ["function swapAlfaForLau() payable"];

const getProvider = () => {
  if (!(window as any).ethereum) {
    log("MetaMask not detected.");
    return null;
  }
  return new ethers.BrowserProvider((window as any).ethereum);
};

export const connectWallet = async (): Promise<string | null> => {
  try {
    const provider = getProvider();
    if (!provider) return null;
    const accounts = await provider.send("eth_requestAccounts", []);
    log("Wallet connection successful.");
    return accounts[0];
  } catch (error) {
    log("Wallet connection failed.");
    console.error(error);
    return null;
  }
};

export const getTokenBalance = async (walletAddress: string): Promise<number> => {
  try {
    if (!ethers.isAddress(walletAddress)) {
      log(`Skipping token balance check for non-standard address: ${walletAddress}`);
      return 0;
    }
    const provider = getProvider();
    if (!provider) return 0;
    if (LAUCOIN_ADDRESS === ethers.ZeroAddress) return 0;

    const contract = new ethers.Contract(LAUCOIN_ADDRESS, ERC20_ABI, provider);
    const balance = await contract.balanceOf(walletAddress);
    const formattedBalance = parseFloat(ethers.formatUnits(balance, 18));
    log(`Token balance check successful: ${formattedBalance} LAU`);
    return formattedBalance;
  } catch (error) {
    log("Token balance check failed.");
    console.error(error);
    return 0;
  }
};

export const getAlfaBalance = async (walletAddress: string): Promise<number> => {
  try {
    if (!ethers.isAddress(walletAddress)) {
      log(`Skipping ALFA balance check for non-standard address: ${walletAddress}`);
      return 0;
    }
    const provider = getProvider();
    if (!provider) return 0;
    const balance = await provider.getBalance(walletAddress);
    const formattedBalance = parseFloat(ethers.formatEther(balance));
    log(`ALFA balance check successful: ${formattedBalance} ALFA`);
    return formattedBalance;
  } catch (error) {
    log("ALFA balance check failed.");
    console.error(error);
    return 0;
  }
};

export const checkAccess = (balance: number): boolean => {
  const hasAccess = balance >= 100;
  log(`Access control check: ${hasAccess ? "Unlocked" : "Locked"}`);
  return hasAccess;
};

export const addWordToLexicon = async (word: string): Promise<void> => {
  const sanitizedWord = sanitizeInput(word);
  try {
    if (LEXICON_ADDRESS === ethers.ZeroAddress) {
      log("Lexicon address is zero, skipping transaction.");
      return;
    }
    const provider = getProvider();
    if (!provider) throw new Error("MetaMask not detected.");
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(LEXICON_ADDRESS, LEXICON_ABI, signer);
    
    log(`Initiating Lexicon transaction for word: ${sanitizedWord}`);
    const tx = await contract.addWordToLexicon(sanitizedWord);
    await tx.wait();
    log("Laminar synchronization successful.");
  } catch (error) {
    log("Lexicon transaction failed.");
    console.error(error);
    throw error;
  }
};

export const swapAlfaForLau = async (): Promise<void> => {
  try {
    if (SWAP_CONTRACT_ADDRESS === ethers.ZeroAddress) {
      log("Swap contract address is zero, skipping transaction.");
      return;
    }
    const provider = getProvider();
    if (!provider) throw new Error("MetaMask not detected.");
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(SWAP_CONTRACT_ADDRESS, SWAP_ABI, signer);
    
    log(`Initiating ALFA to LAU swap`);
    const tx = await contract.swapAlfaForLau();
    await tx.wait();
    log("Swap successful.");
  } catch (error) {
    log("Swap failed.");
    console.error(error);
    throw error;
  }
};

export const sendEth = async (toAddress: string, amountInEth: string): Promise<string> => {
  try {
    if (!ethers.isAddress(toAddress)) {
      throw new Error("Invalid Ethereum address.");
    }
    const provider = getProvider();
    if (!provider) throw new Error("MetaMask not detected.");
    const signer = await provider.getSigner();
    
    log(`Initiating ETH transfer: ${amountInEth} ETH to ${toAddress}`);
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amountInEth)
    });
    await tx.wait();
    log(`ETH transfer successful. Hash: ${tx.hash}`);
    return tx.hash;
  } catch (error) {
    log("ETH transfer failed.");
    console.error(error);
    throw error;
  }
};
