import { Connection, Keypair } from '@solana/web3.js';
import dotenv from 'dotenv';
import bs58 from 'bs58';

// Load environment variables
dotenv.config();

// Constants
export const UNIT_BUDGET = 150_000;
export const UNIT_PRICE = 1_000_000;

// Environment variables
const PRIV_KEY = process.env.WALLET_PRIVATE_KEY;
const RPC = process.env.RPC_URL_RAYDIUM;

// Validate required environment variables
if (!PRIV_KEY || !RPC) {
  throw new Error('Missing required environment variables: WALLET_PRIVATE_KEY or RPC_URL_RAYDIUM');
}

// Initialize connection
export const connection = new Connection(RPC, 'confirmed');

// Create keypair from private key
export const payerKeypair = Keypair.fromSecretKey(
  bs58.decode(PRIV_KEY)
);

// Export connection instance for use in other modules
export { Connection };
