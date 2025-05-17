import { 
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  VersionedTransaction,
  MessageV0,
  ComputeBudgetProgram
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AccountLayout,
  createInitializeAccountInstruction,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptAccount
} from "@solana/spl-token";
import crypto from "crypto";

// These functions are assumed to be defined in your application’s utilities.
import { 
  fetchAmmV4PoolKeys, 
  getAmmV4Reserves, 
  makeAmmV4SwapInstruction 
} from "./pool_utils";
import { confirmTxn, getTokenBalance } from "./common_utils";
import { client, payerKeypair, UNIT_BUDGET, UNIT_PRICE, SOL_DECIMAL, WSOL } from "./config";

/**
 * Calculate the number of tokens received for a given SOL amount,
 * using the constant product invariant and accounting for the swap fee.
 */
function solForTokens(
  solAmount: number,
  baseVaultBalance: number,
  quoteVaultBalance: number,
  swapFee = 0.25
): number {
  const effectiveSolUsed = solAmount - solAmount * (swapFee / 100);
  const constantProduct = baseVaultBalance * quoteVaultBalance;
  const updatedBaseVaultBalance = constantProduct / (quoteVaultBalance + effectiveSolUsed);
  const tokensReceived = baseVaultBalance - updatedBaseVaultBalance;
  return Number(tokensReceived.toFixed(9));
}

/**
 * Calculate the amount of SOL received for a given token amount,
 * using the constant product invariant and accounting for the swap fee.
 */
function tokensForSol(
  tokenAmount: number,
  baseVaultBalance: number,
  quoteVaultBalance: number,
  swapFee = 0.25
): number {
  const effectiveTokensSold = tokenAmount * (1 - swapFee / 100);
  const constantProduct = baseVaultBalance * quoteVaultBalance;
  const updatedQuoteVaultBalance = constantProduct / (baseVaultBalance + effectiveTokensSold);
  const solReceived = quoteVaultBalance - updatedQuoteVaultBalance;
  return Number(solReceived.toFixed(9));
}

/**
 * Buy function: executes a swap from SOL to tokens via the AMM V4 pool.
 */
export async function buy(pairAddress: string, solIn = 0.01, slippage = 5): Promise<boolean> {
  try {
    console.log(`Starting buy transaction for pair address: ${pairAddress}`);
    console.log("Fetching pool keys...");
    const poolKeys = await fetchAmmV4PoolKeys(pairAddress);
    if (!poolKeys) {
      console.log("No pool keys found...");
      return false;
    }
    console.log("Pool keys fetched successfully.");

    // Use the base mint unless it is WSOL; otherwise, use the quote mint.
    const mint =
      poolKeys.baseMint.toString() !== WSOL.toString() ? poolKeys.baseMint : poolKeys.quoteMint;

    console.log("Calculating transaction amounts...");
    const amountIn = Math.floor(solIn * SOL_DECIMAL);
    const { baseReserve, quoteReserve, tokenDecimal } = await getAmmV4Reserves(poolKeys);
    const amountOut = solForTokens(solIn, baseReserve, quoteReserve);
    console.log(`Estimated Amount Out: ${amountOut}`);

    const slippageAdjustment = 1 - slippage / 100;
    const amountOutWithSlippage = amountOut * slippageAdjustment;
    const minimumAmountOut = Math.floor(amountOutWithSlippage * Math.pow(10, tokenDecimal));
    console.log(`Amount In: ${amountIn} | Minimum Amount Out: ${minimumAmountOut}`);

    console.log("Checking for existing token account...");
    const tokenAccounts = await client.getTokenAccountsByOwner(payerKeypair.publicKey, {
      mint: mint
    });
    let tokenAccount: PublicKey;
    let createTokenAccountInstruction: TransactionInstruction | null = null;
    if (tokenAccounts.value.length > 0) {
      tokenAccount = new PublicKey(tokenAccounts.value[0].pubkey);
      console.log("Token account found.");
    } else {
      tokenAccount = await getAssociatedTokenAddress(payerKeypair.publicKey, mint);
      createTokenAccountInstruction = createAssociatedTokenAccountInstruction(
        payerKeypair.publicKey,
        tokenAccount,
        payerKeypair.publicKey,
        mint
      );
      console.log("No existing token account found; creating associated token account.");
    }

    // Generate a random seed for the WSOL account.
    const seed = crypto.randomBytes(24).toString("base64url");
    const wsolTokenAccount = await PublicKey.createWithSeed(
      payerKeypair.publicKey,
      seed,
      TOKEN_PROGRAM_ID
    );
    const balanceNeeded = await getMinimumBalanceForRentExemptAccount(client);

    // Create and initialize the WSOL account.
    const createWsolAccountIx = SystemProgram.createAccountWithSeed({
      fromPubkey: payerKeypair.publicKey,
      basePubkey: payerKeypair.publicKey,
      seed: seed,
      newAccountPubkey: wsolTokenAccount,
      lamports: balanceNeeded + amountIn,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID
    });
    const initWsolAccountIx = createInitializeAccountInstruction(
      wsolTokenAccount,
      WSOL,
      payerKeypair.publicKey,
      TOKEN_PROGRAM_ID
    );

    console.log("Creating swap instruction...");
    const swapInstruction = await makeAmmV4SwapInstruction({
      amountIn,
      minimumAmountOut,
      tokenAccountIn: wsolTokenAccount,
      tokenAccountOut: tokenAccount,
      accounts: poolKeys,
      owner: payerKeypair.publicKey
    });

    console.log("Preparing to close WSOL account after swap...");
    const closeWsolAccountIx = createCloseAccountInstruction(
      wsolTokenAccount,
      payerKeypair.publicKey,
      payerKeypair.publicKey,
      [],
      TOKEN_PROGRAM_ID
    );

    const instructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit(UNIT_BUDGET),
      ComputeBudgetProgram.setComputeUnitPrice(UNIT_PRICE),
      createWsolAccountIx,
      initWsolAccountIx
    ];
    if (createTokenAccountInstruction) {
      instructions.push(createTokenAccountInstruction);
    }
    instructions.push(swapInstruction);
    instructions.push(closeWsolAccountIx);

    // Compile the transaction message using the Versioned Transaction API.
    const latestBlockhash = (await client.getLatestBlockhash()).blockhash;
    const messageV0 = new MessageV0({
      payerKey: payerKeypair.publicKey,
      instructions,
      recentBlockhash: latestBlockhash
    });
    const txn = new VersionedTransaction(messageV0);
    txn.sign([payerKeypair]);

    console.log("Sending transaction...");
    const txnSig = await client.sendTransaction(txn, { skipPreflight: true });
    console.log(`[${new Date().toISOString()}] Buy [RA] transaction Signature: ${txnSig}`);

    const confirmed = await confirmTxn(txnSig);
    console.log(`[${new Date().toISOString()}] Buy [RA] transaction confirmed: ${confirmed}`);

    return confirmed;
  } catch (e) {
    console.error(
      `[${new Date().toISOString()}] Error [RA] occurred during buy transaction: ${e}`
    );
    return false;
  }
}

/**
 * Sell function: executes a swap from tokens to SOL via the AMM V4 pool.
 */
export async function sell(pairAddress: string, percentage = 100, slippage = 5): Promise<boolean> {
  try {
    if (percentage < 1 || percentage > 100) {
      console.log(`[${new Date().toISOString()}] Percentage [RA] must be between 1 and 100.`);
      return false;
    }

    const poolKeys = await fetchAmmV4PoolKeys(pairAddress);
    if (!poolKeys) {
      console.log(`[${new Date().toISOString()}] No pool keys [RA] found...`);
      return false;
    }
    const mint =
      poolKeys.baseMint.toString() !== WSOL.toString() ? poolKeys.baseMint : poolKeys.quoteMint;

    let tokenBalance = await getTokenBalance(mint.toString());
    if (!tokenBalance || tokenBalance === 0) {
      console.log(`[${new Date().toISOString()}] Token balance [RA] is zero. Nothing to sell.`);
      return false;
    }
    console.log(`[${new Date().toISOString()}] Sell [RA] token Balance: ${tokenBalance}`);
    tokenBalance = tokenBalance * (percentage / 100);

    const { baseReserve, quoteReserve, tokenDecimal } = await getAmmV4Reserves(poolKeys);
    const amountOut = tokensForSol(tokenBalance, baseReserve, quoteReserve);
    const slippageAdjustment = 1 - slippage / 100;
    const amountOutWithSlippage = amountOut * slippageAdjustment;
    const minimumAmountOut = Math.floor(amountOutWithSlippage * SOL_DECIMAL);
    const amountIn = Math.floor(tokenBalance * Math.pow(10, tokenDecimal));

    const tokenAccount = await getAssociatedTokenAddress(payerKeypair.publicKey, mint);

    const seed = crypto.randomBytes(24).toString("base64url");
    const wsolTokenAccount = await PublicKey.createWithSeed(
      payerKeypair.publicKey,
      seed,
      TOKEN_PROGRAM_ID
    );
    const balanceNeeded = await getMinimumBalanceForRentExemptAccount(client);

    const createWsolAccountIx = SystemProgram.createAccountWithSeed({
      fromPubkey: payerKeypair.publicKey,
      basePubkey: payerKeypair.publicKey,
      seed: seed,
      newAccountPubkey: wsolTokenAccount,
      lamports: balanceNeeded,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID
    });
    const initWsolAccountIx = createInitializeAccountInstruction(
      wsolTokenAccount,
      WSOL,
      payerKeypair.publicKey,
      TOKEN_PROGRAM_ID
    );

    const swapInstruction = await makeAmmV4SwapInstruction({
      amountIn,
      minimumAmountOut,
      tokenAccountIn: tokenAccount,
      tokenAccountOut: wsolTokenAccount,
      accounts: poolKeys,
      owner: payerKeypair.publicKey
    });
    const closeWsolAccountIx = createCloseAccountInstruction(
      wsolTokenAccount,
      payerKeypair.publicKey,
      payerKeypair.publicKey,
      [],
      TOKEN_PROGRAM_ID
    );

    const instructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit(UNIT_BUDGET),
      ComputeBudgetProgram.setComputeUnitPrice(UNIT_PRICE),
      createWsolAccountIx,
      initWsolAccountIx,
      swapInstruction,
      closeWsolAccountIx
    ];

    if (percentage === 100) {
      const closeTokenAccountIx = createCloseAccountInstruction(
        tokenAccount,
        payerKeypair.publicKey,
        payerKeypair.publicKey,
        [],
        TOKEN_PROGRAM_ID
      );
      instructions.push(closeTokenAccountIx);
    }

    const latestBlockhash = (await client.getLatestBlockhash()).blockhash;
    const messageV0 = new MessageV0({
      payerKey: payerKeypair.publicKey,
      instructions,
      recentBlockhash: latestBlockhash
    });
    const txn = new VersionedTransaction(messageV0);
    txn.sign([payerKeypair]);

    console.log("Sending transaction...");
    const txnSig = await client.sendTransaction(txn, { skipPreflight: true });
    console.log(`[${new Date().toISOString()}] Sell [RA] transaction Signature: ${txnSig}`);

    const confirmed = await confirmTxn(txnSig);
    console.log(`[${new Date().toISOString()}] Sell [RA] transaction confirmed: ${confirmed}`);

    return confirmed;
  } catch (e) {
    console.error(
      `[${new Date().toISOString()}] Error [RA] occurred during sell transaction: ${e}`
    );
    return false;
  }
}
