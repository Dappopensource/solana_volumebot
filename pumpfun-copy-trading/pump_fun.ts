import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  VersionedTransaction,
  MessageV0,
  AccountMeta
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createCloseAccountInstruction } from '@solana/spl-token';
import { Buffer } from 'buffer';

// Utility function to pack numbers into Buffer
function packUint64LE(num: number): Buffer {
  const arr = new ArrayBuffer(8);
  const view = new DataView(arr);
  view.setBigUint64(0, BigInt(num), true);
  return Buffer.from(arr);
}

export async function buy(
  connection: Connection,
  mint: string, 
  solIn: number = 0.01,
  slippage: number = 5
): Promise<boolean> {
  try {
    const coinData = await getCoinData(mint);
    if (!coinData) {
      console.log(`Failed to retrieve coin data while buying!`);
      return false;
    }

    if (coinData.complete) {
      console.log(`Warning: This token has bonded and is only buyable on Raydium.`);
      return false;
    }<sup data-citation="4" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="#" title="Reference 4 (source not available)">4</a></sup>

    const MINT = new PublicKey(mint);
    const USER = payer.publicKey;

    // Get or create associated token account
    let ASSOCIATED_USER: PublicKey;
    let tokenAccountInstruction: TransactionInstruction | null = null;

    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(USER, { mint: MINT });
      ASSOCIATED_USER = tokenAccounts.value[0].pubkey;
    } catch {
      ASSOCIATED_USER = await getAssociatedTokenAddress(MINT, USER);
      tokenAccountInstruction = createAssociatedTokenAccountInstruction(
        USER,
        ASSOCIATED_USER, 
        USER,
        MINT
      );
    }<sup data-citation="4" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="#" title="Reference 4 (source not available)">4</a></sup>

    // Calculate amounts
    const SOL_DECIMALS = 1e9;
    const TOKEN_DECIMALS = 1e6;
    
    const virtualSolReserves = coinData.virtualSolReserves / SOL_DECIMALS;
    const virtualTokenReserves = coinData.virtualTokenReserves / TOKEN_DECIMALS;
    
    const amount = solForTokens(solIn, virtualSolReserves, virtualTokenReserves);
    const amountWithDecimals = Math.floor(amount * TOKEN_DECIMALS);

    const slippageAdjustment = 1 + (slippage / 100);
    const maxSolCost = Math.floor((solIn * slippageAdjustment) * SOL_DECIMALS);

    // Create swap instruction
    const instructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: UNIT_BUDGET }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: UNIT_PRICE })
    ];

    if (tokenAccountInstruction) {
      instructions.push(tokenAccountInstruction);
    }<sup data-citation="7" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="#" title="Reference 7 (source not available)">7</a></sup>

    // Construct swap data
    const data = Buffer.concat([
      Buffer.from('66063d1201daebea', 'hex'),
      packUint64LE(amountWithDecimals),
      packUint64LE(maxSolCost)
    ]);

    const swapInstruction = new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM,
      keys: [
        {pubkey: GLOBAL, isSigner: false, isWritable: false},
        {pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true},
        // ... other account metas
      ],
      data
    });

    instructions.push(swapInstruction);

    // Add priority fee if needed for transaction confirmation
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: UNIT_PRICE 
    });
    instructions.push(priorityFee);<sup data-citation="7" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="#" title="Reference 7 (source not available)">7</a></sup>

    // Create and send transaction
    const latestBlockhash = await connection.getLatestBlockhash();
    
    const messageV0 = MessageV0.compile({
      payerKey: payer.publicKey,
      instructions,
      recentBlockhash: latestBlockhash.blockhash
    });

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([payer]);

    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: true,
      maxRetries: 3
    });

    const confirmation = await connection.confirmTransaction(signature);
    
    console.log(`Buy transaction confirmed: ${confirmation.value.err === null}`);
    return confirmation.value.err === null;

  } catch (error) {
    console.error(`Error occurred during buy transaction: ${error}`);
    return false;
  }
}

// Sell function follows similar pattern with sell-specific logic
export async function sell(
  connection: Connection,
  mint: string,
  percentage: number = 100,
  slippage: number = 5
): Promise<boolean | null> {
  try {
    if (percentage < 1 || percentage > 100) {
      console.log('Percentage must be between 1 and 100');
      return false;
    }

    const coinData = await getCoinData(mint);
    if (!coinData) {
      console.log('Failed to retrieve coin data while selling');
      return false;
    }

    // Get token balance
    const tokenBalance = await getTokenBalance(payer.publicKey, mint);
    if (!tokenBalance || tokenBalance === 0) {
      console.log('Token balance is zero. Nothing to sell.');
      return null;
    }<sup data-citation="4" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="#" title="Reference 4 (source not available)">4</a></sup>

    // Calculate sell amounts
    const adjustedBalance = tokenBalance * (percentage / 100);
    const amount = Math.floor(adjustedBalance * 1e6);

    const solOut = tokensForSol(
      adjustedBalance,
      coinData.virtualSolReserves / 1e9,
      coinData.virtualTokenReserves / 1e6
    );

    const slippageAdjustment = 1 - (slippage / 100);
    const minSolOutput = Math.floor((solOut * slippageAdjustment) * 1e9);

    // Create instructions array similar to buy function
    const instructions: TransactionInstruction[] = [];
    
    // Add sell instruction
    const sellData = Buffer.concat([
      Buffer.from('33e685a4017f83ad', 'hex'),
      packUint64LE(amount),
      packUint64LE(minSolOutput)
    ]);

    // ... rest of sell implementation following similar pattern to buy
    
    return true;

  } catch (error) {
    console.error(`Error occurred during sell transaction: ${error}`);
    return false;
  }
}
