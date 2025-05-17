/**
 * raydiumSwap.ts
 *
 * This file shows an example of converting the Python buy/sell logic to
 * TypeScript using @solana/web3.js, @solana/spl-token and hypothetical
 * Raydium helper modules. You may need to adjust helper functions,
 * types, and imported modules based on your actual libraries.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createCloseAccountInstruction,
} from '@solana/spl-token';
import { randomBytes } from 'crypto';
import base64url from 'base64url';

// Hypothetical Raydium helper modules – adjust based on your actual library names.
import {
  fetchCpmmPoolKeys,
  getCpmmReserves,
  makeCpmmSwapInstruction,
  CpmmPoolKeys,
  DIRECTION,
} from 'raydium-js/pool_utils';
import { confirmTxn, getTokenBalance } from 'raydium-js/utils/common_utils';
import { setComputeUnitLimit, setComputeUnitPrice } from 'raydium-js/computeBudget';
import { TxOpts } from 'raydium-js/types'; // if you have a dedicated type for transaction options

// Constants and configuration
const SOL_DECIMAL = 1_000_000_000;
const ACCOUNT_LAYOUT_LEN = 165; // standard token account size for SPL tokens
// WSOL is the Wrapped SOL mint address as a string
export const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
// These values can be configured externally
const UNIT_BUDGET = 400000; // example: maximum compute units
const UNIT_PRICE = 1; // example: compute unit price

// Set up your connection and payer Keypair (ensure proper private key management)
const connection = new Connection('https://api.mainnet-beta.solana.com');
const payer = Keypair.generate(); // In practice, load your keypair securely

/**
 * Helper function.
 *
 * Returns the expected tokens received for a given SOL input.
 */
export function solForTokens(
  solAmount: number,
  baseVaultBalance: number,
  quoteVaultBalance: number,
  swapFee = 0.25
): number {
  const effectiveSolUsed = solAmount - solAmount * (swapFee / 100);
  const constantProduct = baseVaultBalance * quoteVaultBalance;
  const updatedBaseVaultBalance = constantProduct / (quoteVaultBalance + effectiveSolUsed);
  const tokensReceived = baseVaultBalance - updatedBaseVaultBalance;
  return parseFloat(tokensReceived.toFixed(9));
}

/**
 * Helper function.
 *
 * Returns the expected SOL received for a given token amount input.
 */
export function tokensForSol(
  tokenAmount: number,
  baseVaultBalance: number,
  quoteVaultBalance: number,
  swapFee = 0.25
): number {
  const effectiveTokensSold = tokenAmount * (1 - swapFee / 100);
  const constantProduct = baseVaultBalance * quoteVaultBalance;
  const updatedQuoteVaultBalance = constantProduct / (baseVaultBalance + effectiveTokensSold);
  const solReceived = quoteVaultBalance - updatedQuoteVaultBalance;
  return parseFloat(solReceived.toFixed(9));
}

/**
 * Executes a buy (swap SOL for tokens) transaction.
 *
 * @param pairAddress - The pool address as a string.
 * @param solIn - SOL input amount (in SOL, not lamports).
 * @param slippage - Allowed slippage percentage.
 * @returns Promise that resolves to true if the transaction was confirmed.
 */
export async function buy(
  pairAddress: string,
  solIn = 0.1,
  slippage = 1
): Promise<boolean> {
  console.log(`Starting buy transaction for pair address: ${pairAddress}`);

  // Fetch pool keys (assumed to be implemented to return a CpmmPoolKeys object)
  console.log('Fetching pool keys...');
  const poolKeys: CpmmPoolKeys | null = await fetchCpmmPoolKeys(pairAddress);
  if (!poolKeys) {
    console.log('No pool keys found...');
    return false;
  }
  console.log('Pool keys fetched successfully.');

  // Determine the proper mint and token program based on WSOL presence.
  let mint: PublicKey;
  let tokenProgram: PublicKey;
  if (poolKeys.token_0_mint.equals(WSOL)) {
    mint = poolKeys.token_1_mint;
    tokenProgram = poolKeys.token_1_program;
  } else {
    mint = poolKeys.token_0_mint;
    tokenProgram = poolKeys.token_0_program;
  }

  console.log('Calculating transaction amounts...');
  const amountIn = Math.floor(solIn * SOL_DECIMAL);

  // Get current pool reserves and token decimal information.
  const { baseReserve, quoteReserve, tokenDecimal } = await getCpmmReserves(poolKeys);
  const estimatedAmount = solForTokens(solIn, baseReserve, quoteReserve);
  console.log(`Estimated Amount Out: ${estimatedAmount}`);

  const slippageAdjustment = 1 - slippage / 100;
  const amountOutWithSlippage = estimatedAmount * slippageAdjustment;
  const minimumAmountOut = Math.floor(amountOutWithSlippage * Math.pow(10, tokenDecimal));
  console.log(`Amount In: ${amountIn} | Minimum Amount Out: ${minimumAmountOut}`);

  // Check for existing token account owned by the payer
  console.log('Checking for existing token account...');
  const tokenAccounts = await connection.getTokenAccountsByOwner(payer.publicKey, {
    mint: mint,
  });
  let tokenAccount: PublicKey;
  let tokenAccountIx: TransactionInstruction | null = null;
  if (tokenAccounts.value.length > 0) {
    tokenAccount = tokenAccounts.value[0].pubkey;
    console.log('Token account found.');
  } else {
    // Calculate the associated token account address
    tokenAccount = await getAssociatedTokenAddress(mint, payer.publicKey, false, TOKEN_PROGRAM_ID);
    tokenAccountIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      tokenAccount,
      payer.publicKey,
      mint,
      TOKEN_PROGRAM_ID
    );
    console.log('No existing token account found; creating associated token account.');
  }

  // Generate a seed for the WSOL account
  console.log('Generating seed for WSOL account...');
  const seed = base64url(randomBytes(24));
  const wsolTokenAccount = await PublicKey.createWithSeed(payer.publicKey, seed, TOKEN_PROGRAM_ID);

  // Get minimum lamports for rent exemption for an account
  const balanceNeeded = await connection.getMinimumBalanceForRentExemption(ACCOUNT_LAYOUT_LEN);

  console.log('Creating and initializing WSOL account...');
  // Create account with seed (using SystemProgram.createAccountWithSeed)
  const createWsolAccountIx = SystemProgram.createAccountWithSeed({
    fromPubkey: payer.publicKey,
    basePubkey: payer.publicKey,
    seed: seed,
    newAccountPubkey: wsolTokenAccount,
    lamports: balanceNeeded + amountIn,
    space: ACCOUNT_LAYOUT_LEN,
    programId: TOKEN_PROGRAM_ID,
  });

  // Initialize account instruction for WSOL (using SPL Token helper)
  const initWsolAccountIx = createInitializeAccountInstruction(
    wsolTokenAccount,
    WSOL,
    payer.publicKey,
    TOKEN_PROGRAM_ID
  );

  // Create swap instruction using the Raydium helper function (assumed signature)
  console.log('Creating swap instruction...');
  const swapIx = await makeCpmmSwapInstruction({
    amountIn,
    minimumAmountOut,
    tokenAccountIn: wsolTokenAccount,
    tokenAccountOut: tokenAccount,
    poolKeys,
    owner: payer.publicKey,
    action: DIRECTION.BUY,
  });

  // Prepare instruction to close the WSOL account after swap
  console.log('Preparing to close WSOL account after swap...');
  const closeWsolAccountIx = createCloseAccountInstruction(
    wsolTokenAccount,
    payer.publicKey,
    payer.publicKey,
    [],
    TOKEN_PROGRAM_ID
  );

  // Build the transaction instructions array.
  const instructions: TransactionInstruction[] = [
    // Custom compute unit instructions (assumed implemented in your project):
    setComputeUnitLimit(UNIT_BUDGET),
    setComputeUnitPrice(UNIT_PRICE),
    createWsolAccountIx,
    initWsolAccountIx,
  ];

  if (tokenAccountIx) {
    instructions.push(tokenAccountIx);
  }
  instructions.push(swapIx);
  instructions.push(closeWsolAccountIx);

  console.log('Compiling transaction message...');
  const transaction = new Transaction().add(...instructions);
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  console.log('Sending transaction...');
  try {
    const txSignature = await sendAndConfirmTransaction(connection, transaction, [payer], {
      skipPreflight: true,
    });
    console.log('Transaction Signature:', txSignature);

    console.log('Confirming transaction...');
    const confirmed = await confirmTxn(connection, txSignature);
    console.log('Transaction confirmed:', confirmed);
    return confirmed;
  } catch (error) {
    console.log('Error during transaction:', error);
    return false;
  }
}

/**
 * Executes a sell (swap tokens for SOL) transaction.
 *
 * @param pairAddress - The pool address as a string.
 * @param percentage - Percentage of the token balance to sell.
 * @param slippage - Allowed slippage percentage.
 * @returns Promise that resolves to true if the transaction was confirmed.
 */
export async function sell(
  pairAddress: string,
  percentage = 100,
  slippage = 1
): Promise<boolean> {
  try {
    console.log('Fetching pool keys...');
    const poolKeys: CpmmPoolKeys | null = await fetchCpmmPoolKeys(pairAddress);
    if (!poolKeys) {
      console.log('No pool keys found...');
      return false;
    }
    console.log('Pool keys fetched successfully.');

    // Determine mint and token program ID depending on which is WSOL.
    let mint: PublicKey;
    let tokenProgramId: PublicKey;
    if (poolKeys.token_0_mint.equals(WSOL)) {
      mint = poolKeys.token_1_mint;
      tokenProgramId = poolKeys.token_1_program;
    } else {
      mint = poolKeys.token_0_mint;
      tokenProgramId = poolKeys.token_0_program;
    }

    console.log('Retrieving token balance...');
    let tokenBalance = await getTokenBalance(mint.toString());
    console.log('Token Balance:', tokenBalance);

    if (!tokenBalance || tokenBalance === 0) {
      console.log('No token balance available to sell.');
      return false;
    }
    tokenBalance = tokenBalance * (percentage / 100);
    console.log(`Selling ${percentage}% of the token balance, adjusted balance: ${tokenBalance}`);

    console.log('Calculating transaction amounts...');
    const { baseReserve, quoteReserve, tokenDecimal } = await getCpmmReserves(poolKeys);
    const estimatedAmount = tokensForSol(tokenBalance, baseReserve, quoteReserve);
    console.log(`Estimated Amount Out: ${estimatedAmount}`);

    const slippageAdjustment = 1 - slippage / 100;
    const amountOutWithSlippage = estimatedAmount * slippageAdjustment;
    const minimumAmountOut = Math.floor(amountOutWithSlippage * SOL_DECIMAL);

    const amountIn = Math.floor(tokenBalance * Math.pow(10, tokenDecimal));
    console.log(`Amount In: ${amountIn} | Minimum Amount Out: ${minimumAmountOut}`);

    // Get the associated token account address for the payer.
    const tokenAccount = await getAssociatedTokenAddress(mint, payer.publicKey, false, tokenProgramId);

    console.log('Generating seed and creating WSOL account...');
    const seed = base64url(randomBytes(24));
    const wsolTokenAccount = await PublicKey.createWithSeed(payer.publicKey, seed, TOKEN_PROGRAM_ID);
    const balanceNeeded = await connection.getMinimumBalanceForRentExemption(ACCOUNT_LAYOUT_LEN);

    const createWsolAccountIx = SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      basePubkey: payer.publicKey,
      seed: seed,
      newAccountPubkey: wsolTokenAccount,
      lamports: balanceNeeded,
      space: ACCOUNT_LAYOUT_LEN,
      programId: TOKEN_PROGRAM_ID,
    });

    const initWsolAccountIx = createInitializeAccountInstruction(
      wsolTokenAccount,
      WSOL,
      payer.publicKey,
      TOKEN_PROGRAM_ID
    );

    console.log('Creating swap instruction...');
    const swapIx = await makeCpmmSwapInstruction({
      amountIn,
      minimumAmountOut,
      tokenAccountIn: tokenAccount,
      tokenAccountOut: wsolTokenAccount,
      poolKeys,
      owner: payer.publicKey,
      action: DIRECTION.SELL,
    });

    console.log('Preparing to close WSOL account after swap...');
    const closeWsolAccountIx = createCloseAccountInstruction(
      wsolTokenAccount,
      payer.publicKey,
      payer.publicKey,
      [],
      TOKEN_PROGRAM_ID
    );

    // If selling 100% of balance, add an instruction to close the token account.
    const instructions: TransactionInstruction[] = [
      setComputeUnitLimit(UNIT_BUDGET),
      setComputeUnitPrice(UNIT_PRICE),
      createWsolAccountIx,
      initWsolAccountIx,
      swapIx,
      closeWsolAccountIx,
    ];
    if (percentage === 100) {
      console.log('Preparing to close token account after swap...');
      const closeTokenAccountIx = createCloseAccountInstruction(
        tokenAccount,
        payer.publicKey,
        payer.publicKey,
        [],
        tokenProgramId
      );
      instructions.push(closeTokenAccountIx);
    }

    console.log('Compiling transaction message...');
    const transaction = new Transaction().add(...instructions);
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    console.log('Sending transaction...');
    const txSignature = await sendAndConfirmTransaction(connection, transaction, [payer], {
      skipPreflight: true,
    });
    console.log('Transaction Signature:', txSignature);

    console.log('Confirming transaction...');
    const confirmed = await confirmTxn(connection, txSignature);
    console.log('Transaction confirmed:', confirmed);
    return confirmed;
  } catch (error) {
    console.error('Error occurred during transaction:', error);
    return false;
  }
}
