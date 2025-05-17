import { Connection, PublicKey, Commitment, ParsedTransactionWithMeta } from '@solana/web3.js';
import { getCoinData } from './coin_data';

const connection = new Connection(process.env.RPC_URL_RAYDIUM || '', 'processed');

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getTokenBalance(pubKey: PublicKey, mintStr: string): Promise<number | null> {
  try {
    const mint = new PublicKey(mintStr);
    const response = await connection.getParsedTokenAccountsByOwner(pubKey, { mint }, 'processed');
    if (response.value.length > 0) {
      const tokenAmount = response.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return Number(tokenAmount);
    }
    return null;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching token balance: ${error}`);
    return null;
  }
}

export async function confirmTxn(txnSig: string, maxRetries: number = 20, retryInterval: number = 3000): Promise<boolean | null> {
  let retries = 1;
  while (retries < maxRetries) {
    try {
      const txnRes: ParsedTransactionWithMeta | null = await connection.getTransaction(txnSig, {
        commitment: 'confirmed' as Commitment,
      });
      if (txnRes) {
        // Check if transaction executed without error
        if (txnRes.meta && txnRes.meta.err === null) {
          console.log(`[${new Date().toISOString()}] Transaction confirmed on try count: ${retries}`);
          return true;
        }
        if (txnRes.meta && txnRes.meta.err) {
          console.log(`[${new Date().toISOString()}] Transaction failed with error: ${JSON.stringify(txnRes.meta.err)}`);
          return false;
        }
      } else {
        console.log(`[${new Date().toISOString()}] Transaction not found. Retrying... Count: ${retries}`);
      }
    } catch (error) {
      // If an error occurs, just log and retry
      console.log(`[${new Date().toISOString()}] Awaiting confirmation... try count: ${retries}`);
    }
    retries++;
    await sleep(retryInterval);
  }
  console.log(`[${new Date().toISOString()}] Max retries reached. Transaction confirmation failed.`);
  return null;
}

export async function getTokenPrice(mintStr: string): Promise<number | null> {
  try {
    const coinData = await getCoinData(mintStr);
    if (!coinData) {
      console.log(`[${new Date().toISOString()}] Failed to retrieve coin data!`);
      return null;
    }
    const virtualSolReserves = coinData.virtualSolReserves / 1e9;
    const virtualTokenReserves = coinData.virtualTokenReserves / 1e6;
    const tokenPrice = virtualSolReserves / virtualTokenReserves;
    console.log(`[${new Date().toISOString()}] Token Price: ${tokenPrice.toFixed(20)} SOL!`);
    return tokenPrice;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error calculating token price: ${error}`);
    return null;
  }
}
