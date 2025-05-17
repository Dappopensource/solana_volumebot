import { PublicKey, Commitment, GetTokenAccountsFilter } from '@solana/web3.js';
import { client, payerKeypair } from './config';

// Note: When calling "getTokenAccountsByOwner", ensure you use the "jsonParsed" encoding in your client configuration  
// if you need parsed account data. <sup data-citation="1" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://docs.chainstack.com/docs/transferring-spl-tokens-on-solana-typescript" target="_blank" title="Solana: Transferring SPL tokens in TypeScript">1</a></sup><sup data-citation="2" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://www.quicknode.com/guides/solana-development/spl-tokens/how-to-transfer-spl-tokens-on-solana" target="_blank" title="How to Transfer SPL Tokens on Solana">2</a></sup>

// Retrieves the token balance (uiAmount) for the first token account found for the given mint.
export async function getTokenBalance(mintStr: string): Promise<number | null> {
  const mint = new PublicKey(mintStr);
  const filters: GetTokenAccountsFilter = { mint };
  const response = await client.getTokenAccountsByOwner(payerKeypair.publicKey, filters, { commitment: 'processed', encoding: 'jsonParsed' });
  
  if (response.value && response.value.length > 0) {
    // Access the parsed account info
    const accountData = response.value[0].account.data;
    // Ensure that the "parsed" field exists and contains tokenAmount.uiAmount
    if ('parsed' in accountData) {
      const parsedInfo = (accountData as any).parsed?.info;
      const tokenAmount = parsedInfo?.tokenAmount?.uiAmount;
      if (tokenAmount !== null && tokenAmount !== undefined) {
        return parseFloat(tokenAmount);
      }
    }
  }
  return null;
}

// Confirms a transaction by repeatedly checking its status until confirmed, failed, or max retries reached.
export async function confirmTxn(
  txnSig: string,
  maxRetries: number = 20,
  retryInterval: number = 3000 // in milliseconds
): Promise<boolean | null> {
  let retries = 1;
  while (retries < maxRetries) {
    try {
      const txnRes = await client.getTransaction(txnSig, {
        encoding: 'json',
        commitment: 'confirmed' as Commitment,
        maxSupportedTransactionVersion: 0
      });
      
      if (txnRes.value && txnRes.value.meta) {
        // If there is no error, the transaction is confirmed.
        if (txnRes.value.meta.err === null) {
          console.log(`[${new Date().toISOString()}] Transaction [RA] confirmed... try count: ${retries}!`);
          return true;
        }
        console.log(`[${new Date().toISOString()}] Transaction [RA] not confirmed. Retrying...`);
        // If there is an error, log it and return false.
        console.log(`[${new Date().toISOString()}] Transaction [RA] failed! Error: ${JSON.stringify(txnRes.value.meta.err)}`);
        return false;
      }
    } catch (error) {
      // If an error occurs (e.g. network issues), wait and retry.
    }
    retries++;
    // Wait for the specified retry interval before the next attempt.
    await new Promise((resolve) => setTimeout(resolve, retryInterval));
  }
  // If max retries reached without confirmation, return null.
  return null;
}
