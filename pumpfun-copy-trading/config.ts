import dotenv from 'dotenv';
import { Connection, Keypair } from '@solana/web3.js';

// Load environment variables
dotenv.config();

// Constants
const UNIT_BUDGET = 100_000;
const UNIT_PRICE = 1_000_000;

// Environment variables
const PRIV_KEY = process.env.WALLET_PRIVATE_KEY;
const RPC = process.env.RPC_URL_RAYDIUM;

if (!PRIV_KEY || !RPC) {
  throw new Error('Missing required environment variables');
}

// Initialize Solana connection
const connection = new Connection(RPC, 'confirmed');

// Create keypair from private key
const payer_keypair = Keypair.fromSecretKey(
  Buffer.from(PRIV_KEY, 'base58')
);
