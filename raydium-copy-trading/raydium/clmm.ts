import { 
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  VersionedTransaction,
  Message0,
  ComputeBudgetProgram,
  TransactionOptions
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

// These utility functions must be defined elsewhere in your project.
import {
  fetchClmmPoolKeys,
  makeClmmSwapInstruction,
  DIRECTION
} from "./clmm_pool_utils";  // adjust import path accordingly
import { confirmTxn, getTokenBalance } from "./common_utils";
import { client, payerKeypair, UNIT_BUDGET, UNIT_PRICE, SOL_DECIMAL, WSOL } from "./config";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// Helper: Convert sqrtPriceX64 to token price.
export function sqrtPriceX64ToTokenPrice(
  sqrtPriceX64: bigint | number,
  mintDecimals0: number,
  mintDecimals1: number
): number {
  // Use bigint arithmetic if needed; here we convert to number.
  // tokenPrice = 2^128 / (sqrtPriceX64^2) * 10^(mint_decimals_1 - mint_decimals_0)
  const twoPow128 = Math.pow(2, 128);
  const sqrtPrice = typeof sqrtPriceX64 === "bigint" ? Number(sqrtPriceX64) : sqrtPriceX64;
  const tokenPrice = (twoPow128 / (sqrtPrice * sqrtPrice)) * Math.pow(10, mintDecimals1 - mintDecimals0);
  return tokenPrice;
}

// Helper: Calculate tokens received for given SOL input based on pool price.
export function solForTokens(
  solIn: number,
  sqrtPriceX64: bigint | number,
  mintDecimals0: number,
  mintDecimals1: number
): number {
  const price = sqrtPriceX64ToTokenPrice(sqrtPriceX64, mintDecimals0, mintDecimals1);
  const tokensOut = solIn / price;
  return parseFloat(tokensOut.toFixed(9));
}

// Helper: Calculate SOL received for given token input based on pool price.
export function tokensForSol(
  tokensIn: number,
  sqrtPriceX64: bigint | number,
  mintDecimals0: number,
  mintDecimals1: number
): number {
  const price = sqrtPriceX64ToTokenPrice(sqrtPriceX64, mintDecimals0, mintDecimals1);
  const solOut = tokensIn * price;
  return parseFloat(solOut.toFixed(9));
}

// Buy function: executes a swap from SOL to tokens using a CLMM pool.
export async function buy(pairAddress: string, solIn: number = 0.1): Promise<boolean> {
  try {
    console.log(`Starting buy transaction for pair address: ${pairAddress}`);
    
    console.log("Fetching pool keys...");
    const poolKeys = await fetchClmmPoolKeys(pairAddress);
    if (!poolKeys) {
      console.log("No pool keys found...");
      return false;
    }
    console.log("Pool keys fetched successfully.");

    // Determine the mint: if token_mint_0 equals WSOL then use token_mint_1, else use token_mint_0.
    let mint: PublicKey;
    if (poolKeys.token_mint_0.equals(WSOL)) {
      mint = poolKeys.token_mint_1;
    } else {
      mint = poolKeys.token_mint_0;
    }

    // Determine token program. Get account info using client.getAccountInfo and check the program.
    const tokenInfoResp = await client.getAccountInfo(mint);
    let tokenProgram: PublicKey;
    if (tokenInfoResp && tokenInfoResp.owner.equals(TOKEN_PROGRAM_ID)) {
      tokenProgram = TOKEN_PROGRAM_ID;
    } else {
      tokenProgram = TOKEN_2022_PROGRAM_ID;
    }

    console.log("Calculating transaction amounts...");
    const amount = Math.floor(solIn * SOL_DECIMAL);
    const tokensOut = solForTokens(solIn, poolKeys.sqrt_price_x64, poolKeys.mint_decimals_0, poolKeys.mint_decimals_1);
    console.log(`Amount In: ${solIn} SOL | Estimated Amount Out: ${tokensOut}`);

    console.log("Checking for existing token account...");
    const tokenAccounts = await client.getTokenAccountsByOwner(payerKeypair.publicKey, { mint: mint });
    let tokenAccount: PublicKey;
    let tokenAccountInstruction: TransactionInstruction | null = null;
    if (tokenAccounts.value.length > 0) {
      tokenAccount = new PublicKey(tokenAccounts.value[0].pubkey);
      console.log("Token account found.");
    } else {
      tokenAccount = await getAssociatedTokenAddress(mint, payerKeypair.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      tokenAccountInstruction = createAssociatedTokenAccountInstruction(
        payerKeypair.publicKey,
        tokenAccount,
        payerKeypair.publicKey,
        mint,
        tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      console.log("No existing token account found; creating associated token account.");
    }

    console.log("Generating seed for WSOL account...");
    const seed = crypto.randomBytes(24).toString("base64url");
    const wsolTokenAccount = await PublicKey.createWithSeed(payerKeypair.publicKey, seed, TOKEN_PROGRAM_ID);
    const balanceNeeded = await getMinimumBalanceForRentExemptAccount(client, AccountLayout.span);

    console.log("Creating and initializing WSOL account...");
    const createWsolAccountIx = SystemProgram.createAccountWithSeed({
      fromPubkey: payerKeypair.publicKey,
      basePubkey: payerKeypair.publicKey,
      seed: seed,
      newAccountPubkey: wsolTokenAccount,
      lamports: balanceNeeded + amount,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID,
    });
    const initWsolAccountIx = createInitializeAccountInstruction(
      wsolTokenAccount,
      WSOL,
      payerKeypair.publicKey,
      TOKEN_PROGRAM_ID
    );

    console.log("Creating swap instruction...");
    const swapInstruction = await makeClmmSwapInstruction({
      amount,
      tokenAccountIn: wsolTokenAccount,
      tokenAccountOut: tokenAccount,
      accounts: poolKeys,
      payer: payerKeypair.publicKey,
      action: DIRECTION.BUY
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
      initWsolAccountIx,
    ];
    if (tokenAccountInstruction) {
      instructions.push(tokenAccountInstruction);
    }
    instructions.push(swapInstruction);
    instructions.push(closeWsolAccountIx);

    console.log("Compiling transaction message...");
    const latestBlockhashInfo = await client.getLatestBlockhash();
    const messageV0 = MessageV0.compile({
      payerKey: payerKeypair.publicKey,
      instructions,
      recentBlockhash: latestBlockhashInfo.blockhash,
    });
    const txn = new VersionedTransaction(messageV0);
    txn.sign([payerKeypair]);

    console.log("Sending transaction...");
    const txnSig = (await client.sendTransaction(txn, { skipPreflight: false })) as string;
    console.log("Transaction Signature:", txnSig);

    console.log("Confirming transaction...");
    const confirmed = await confirmTxn(txnSig);
    console.log("Transaction confirmed:", confirmed);
    return confirmed;
  } catch (e) {
    console.error("Error occurred during buy transaction:", e);
    return false;
  }
}

// Sell function: executes a swap from tokens to SOL using a CLMM pool.
export async function sell(pairAddress: string, percentage: number = 100): Promise<boolean> {
  try {
    console.log("Fetching pool keys...");
    const poolKeys = await fetchClmmPoolKeys(pairAddress);
    if (!poolKeys) {
      console.log("No pool keys found...");
      return false;
    }
    console.log("Pool keys fetched successfully.");

    let mint: PublicKey;
    let tokenDecimal: number;
    if (poolKeys.token_mint_0.equals(WSOL)) {
      mint = poolKeys.token_mint_1;
      tokenDecimal = poolKeys.mint_decimals_1;
    } else {
      mint = poolKeys.token_mint_0;
      tokenDecimal = poolKeys.mint_decimals_0;
    }

    const tokenInfoResp = await client.getAccountInfo(mint);
    let tokenProgram: PublicKey;
    if (tokenInfoResp && tokenInfoResp.owner.equals(TOKEN_PROGRAM_ID)) {
      tokenProgram = TOKEN_PROGRAM_ID;
    } else {
      tokenProgram = TOKEN_2022_PROGRAM_ID;
    }

    console.log("Retrieving token balance...");
    let tokenBalance = await getTokenBalance(mint.toString());
    console.log("Token Balance:", tokenBalance);
    if (!tokenBalance || tokenBalance === 0) {
      console.log("No token balance available to sell.");
      return false;
    }
    tokenBalance = tokenBalance * (percentage / 100);
    console.log(`Selling ${percentage}% of the token balance, adjusted balance: ${tokenBalance}`);

    console.log("Calculating transaction amounts...");
    const solOut = tokensForSol(tokenBalance, poolKeys.sqrt_price_x64, poolKeys.mint_decimals_0, poolKeys.mint_decimals_1);
    console.log(`Amount In: ${tokenBalance} tokens | Estimated Amount Out: ${solOut} SOL`);
    const amount = Math.floor(tokenBalance * Math.pow(10, tokenDecimal));
    const tokenAccount = await getAssociatedTokenAddress(mint, payerKeypair.publicKey, false, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID);

    console.log("Generating seed and creating WSOL account...");
    const seed = crypto.randomBytes(24).toString("base64url");
    const wsolTokenAccount = await PublicKey.createWithSeed(payerKeypair.publicKey, seed, TOKEN_PROGRAM_ID);
    const balanceNeeded = await getMinimumBalanceForRentExemptAccount(client, AccountLayout.span);
    const createWsolAccountIx = SystemProgram.createAccountWithSeed({
      fromPubkey: payerKeypair.publicKey,
      basePubkey: payerKeypair.publicKey,
      seed: seed,
      newAccountPubkey: wsolTokenAccount,
      lamports: balanceNeeded,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID,
    });
    const initWsolAccountIx = createInitializeAccountInstruction(
      wsolTokenAccount,
      WSOL,
      payerKeypair.publicKey,
      TOKEN_PROGRAM_ID
    );

    console.log("Creating swap instructions...");
    const swapInstructions = await makeClmmSwapInstruction({
      amount,
      tokenAccountIn: tokenAccount,
      tokenAccountOut: wsolTokenAccount,
      accounts: poolKeys,
      payer: payerKeypair.publicKey,
      action: DIRECTION.SELL
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
      initWsolAccountIx,
      swapInstructions,
      closeWsolAccountIx,
    ];
    if (percentage === 100) {
      console.log("Preparing to close token account after swap...");
      const closeTokenAccountIx = createCloseAccountInstruction(
        tokenAccount,
        payerKeypair.publicKey,
        payerKeypair.publicKey,
        [],
        tokenProgram
      );
      instructions.push(closeTokenAccountIx);
    }

    console.log("Compiling transaction message...");
    const latestBlockhashInfo = await client.getLatestBlockhash();
    const messageV0 = MessageV0.compile({
      payerKey: payerKeypair.publicKey,
      instructions,
      recentBlockhash: latestBlockhashInfo.blockhash,
    });
    const txn = new VersionedTransaction(messageV0);
    txn.sign([payerKeypair]);

    console.log("Sending transaction...");
    const txnSig = (await client.sendTransaction(txn, { skipPreflight: true })) as string;
    console.log("Transaction Signature:", txnSig);

    console.log("Confirming transaction...");
    const confirmed = await confirmTxn(txnSig);
    console.log("Transaction confirmed:", confirmed);
    return confirmed;
  } catch (e) {
    console.error("Error occurred during sell transaction:", e);
    return false;
  }
}
