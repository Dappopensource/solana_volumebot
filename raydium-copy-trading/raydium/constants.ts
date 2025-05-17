import { PublicKey } from '@solana/web3.js';

// Raydium Program IDs
export const RAYDIUM_AMM_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
export const RAYDIUM_CPMM = new PublicKey('CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C');
export const RAYDIUM_CLMM = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');

// Default quote token (SOL)
export const DEFAULT_QUOTE_MINT = 'So11111111111111111111111111111111111111112';

// Token Program IDs
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const MEMO_PROGRAM_V2 = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Account layout constant
export const ACCOUNT_LAYOUT_LEN = 165;

// WSOL constants  
export const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
export const SOL_DECIMAL = 1e9;
