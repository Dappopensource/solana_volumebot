import { PublicKey } from '@solana/web3.js';

// Define interfaces for the parsed data structure
interface VirtualReservesData {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
}

// Main CoinData class
export class CoinData {
  constructor(
    public mint: PublicKey,
    public bondingCurve: PublicKey,
    public associatedBondingCurve: PublicKey,
    public virtualTokenReserves: number,
    public virtualSolReserves: number, 
    public tokenTotalSupply: number,
    public complete: boolean
  ) {}
}

// Helper function to get virtual reserves
export async function getVirtualReserves(bondingCurve: PublicKey): Promise<VirtualReservesData | null> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=ngn&order=market_cap_desc&per_page=250&page=1&sparkline=false');
    const data = await response.json();<sup data-citation="5" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://dev.to/sirneij/django-and-openpyxl-extracting-and-sending-django-model-data-as-excel-file-xlsx-ll3#:~:text=Now%2C%20create%20a%20Code%3A%20tasks%2Epy,excel%20and%20send%20to%20email%2E%22%22%22" target="_blank" title="Extracting and Sending data as Excel file with openpyxl">5</a></sup>

    // Parse the account data according to the structure
    const parsedData: VirtualReservesData = {
      virtualTokenReserves: BigInt(data.virtualTokenReserves),
      virtualSolReserves: BigInt(data.virtualSolReserves), 
      realTokenReserves: BigInt(data.realTokenReserves),
      realSolReserves: BigInt(data.realSolReserves),
      tokenTotalSupply: BigInt(data.tokenTotalSupply),
      complete: Boolean(data.complete)
    };

    return parsedData;
  } catch (error) {
    console.error('Error fetching virtual reserves:', error);
    return null;
  }
}

// Helper function to derive bonding curve accounts
export function deriveBondingCurveAccounts(mintStr: string): [PublicKey | null, PublicKey | null] {
  try {
    const mint = new PublicKey(mintStr);
    
    // Find program address
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      new PublicKey(PUMP_FUN_PROGRAM)
    );

    // Get associated token address
    const associatedBondingCurve = getAssociatedTokenAddress(bondingCurve, mint);

    return [bondingCurve, associatedBondingCurve];
  } catch (error) {
    console.error('Error deriving bonding curve accounts:', error);
    return [null, null];
  }
}

// Main function to get coin data
export async function getCoinData(mintStr: string): Promise<CoinData | null> {
  const [bondingCurve, associatedBondingCurve] = deriveBondingCurveAccounts(mintStr);
  
  if (!bondingCurve || !associatedBondingCurve) {
    return null;
  }

  const virtualReserves = await getVirtualReserves(bondingCurve);
  if (!virtualReserves) {
    return null;
  }

  try {
    return new CoinData(
      new PublicKey(mintStr),
      bondingCurve,
      associatedBondingCurve,
      Number(virtualReserves.virtualTokenReserves),
      Number(virtualReserves.virtualSolReserves),
      Number(virtualReserves.tokenTotalSupply),
      virtualReserves.complete
    );
  } catch (error) {
    console.error('Error creating CoinData:', error);
    return null;
  }
}

// Helper function to calculate SOL for tokens
export function solForTokens(
  solSpent: number,
  solReserves: number, 
  tokenReserves: number
): number {
  const newSolReserves = solReserves + solSpent;
  const newTokenReserves = (solReserves * tokenReserves) / newSolReserves;
  const tokenReceived = tokenReserves - newTokenReserves;

  return Math.round(tokenReceived);
}

// Helper function to calculate tokens for SOL
export function tokensForSol(
  tokensToSell: number,
  solReserves: number,
  tokenReserves: number  
): number {
  const newTokenReserves = tokenReserves + tokensToSell;
  const newSolReserves = (solReserves * tokenReserves) / newTokenReserves;
  const solReceived = solReserves - newSolReserves;

  return solReceived;
}
