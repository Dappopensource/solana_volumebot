import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config(); // load environment variables <sup data-citation="1" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://3commas.io/blog/how-to-build-your-own-crypto-trading-bot-guide" target="_blank" title="Building a Crypto Trading Bot — 2025 How to Guide">1</a></sup>

// --- Utility Functions ---
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCookie(): string {
  try {
    const cookiePath = path.join(__dirname, 'cookie.txt');
    return fs.readFileSync(cookiePath, 'utf8').trim();
  } catch (e) {
    return '';
  }
}

function writeCookie(cookieStr: string): boolean {
  try {
    const cookiePath = path.join(__dirname, 'cookie.txt');
    fs.writeFileSync(cookiePath, cookieStr.trim(), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

function loadInitialPayload(): string[] {
  const payloads: string[] = [];
  const joinPath = path.join(__dirname, 'join.txt');
  const fileContent = fs.readFileSync(joinPath, 'utf8');
  fileContent.split('\n').forEach((line) => {
    if (line.trim().length > 0) {
      payloads.push(line.trim());
    }
  });
  return payloads;
}

// --- Global Variables & Configuration ---
const walletPublicKey: string = process.env.WALLET_PUBLIC_KEY || '';
const trackWallets: string = process.env.TRACK_WALLETS || '';
const maxSlippage: number = parseInt(process.env.MAX_SLIPPAGE || '0', 10);
const solIn: number = parseFloat(process.env.SOL_IN || '0');
const maxSolSpend: number = parseFloat(process.env.MAX_SOL_SPEND || '0');
const allowRebuy: boolean = process.env.ALLOW_REBUY !== 'false';
const maxBuyAttempts: number = parseInt(process.env.MAX_BUY_ATTEMPTS || '0', 10);
const debug: boolean = process.env.DEBUG !== 'false';

// Global runtime state
let buyList: string[] = [];
let startBalance: number = 0.0;
let spent: number = 0.0;

// Dummy implementations of external functions (should be replaced with actual imports)
async function buyPumpFun(tokenAddress: string, solAmount: number, slippage: number): Promise<boolean> {
  // Insert your actual trading logic here.
  if (debug) console.log(`Executing pump buy for ${tokenAddress} with ${solAmount} SOL at slippage ${slippage}`);
  return true;
}

async function sellPumpFun(tokenAddress: string, percentage: number, slippage: number): Promise<boolean> {
  if (debug) console.log(`Executing pump sell for ${tokenAddress} of ${percentage}% at slippage ${slippage}`);
  return true;
}

async function buyRaydium(tokenAddress: string, solAmount: number, slippage: number): Promise<boolean> {
  if (debug) console.log(`Executing raydium buy for ${tokenAddress} with ${solAmount} SOL at slippage ${slippage}`);
  return true;
}

async function sellRaydium(tokenAddress: string, percentage: number, slippage: number): Promise<boolean> {
  if (debug) console.log(`Executing raydium sell for ${tokenAddress} of ${percentage}% at slippage ${slippage}`);
  return true;
}

// --- Network & Trading Functions ---
async function refreshAccessToken(): Promise<void> {
  try {
    console.log(`[${new Date().toLocaleString()}] Refreshing access token...`);
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'cache-control': 'no-cache',
      'dnt': '1',
      'origin': 'https://axiom.trade',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'referer': 'https://axiom.trade/',
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'cookie': readCookie(),
    };

    const response = await axios.post('https://api4.axiom.trade/refresh-access-token', null, {
      headers,
      // Disable certificate verification if necessary (not recommended in production)
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });

    if (response.status !== 200) {
      console.log(`[${new Date().toLocaleString()}] Could not refresh access token!`);
      console.log('Response:', response.data);
      process.exit(1);
    }

    const cookies: string = response.headers['set-cookie'] ? (response.headers['set-cookie'] as string[]).join(' ') : '';
    let newCookie = '';

    const reAuthRefresh = /auth-refresh-token=.*?;/s.exec(cookies);
    if (reAuthRefresh) {
      newCookie += reAuthRefresh[0];
    }
    const reAuthAccess = /auth-access-token=.*?;/s.exec(cookies);
    if (reAuthAccess) {
      newCookie += ' ' + reAuthAccess[0];
    }

    if (!writeCookie(newCookie)) {
      throw new Error('Could not write cookie!');
    }
    console.log(`[${new Date().toLocaleString()}] Access token refreshed!`);
  } catch (e) {
    console.error(`[${new Date().toLocaleString()}] Could not refresh access token!`, e);
    process.exit(1);
  }
}

async function getBalance(): Promise<number | null> {
  try {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [
        walletPublicKey,
        { commitment: 'confirmed' }
      ]
    };

    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'cache-control': 'no-cache',
      'dnt': '1',
      'origin': 'https://axiom.trade',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'referer': 'https://axiom.trade/',
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'cookie': readCookie(),
    };

    const response = await axios.post('https://axiom.trade/api/sol-balance', payload, { headers });
    if (response.status === 200 && response.data?.result?.value) {
      // Divide by 1_000_000_000 to convert lamports to SOL.
      return response.data.result.value / 1_000_000_000;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function calculateMyShare(totalSol: number): number {
  return totalSol * solIn;
}

interface TransactionDetails {
  transaction_type?: string;
  trader_level?: string;
  token_amount?: string;
  maker_address?: string;
  price_sol?: string;
  price_usd?: string;
  total_sol?: string;
  total_usd?: string;
  created_at?: string;
  token_address?: string;
  pair_address?: string;
  token_name?: string;
  token_code?: string;
  protocol?: string;
}

function extractTransactionDetails(data: string): TransactionDetails {
  const details: TransactionDetails = {};
  const patterns: { [key: string]: RegExp } = {
    transaction_type: /"type":"(buy|sell)"/,
    trader_level: /"trader_level":"(.*?)"/,
    token_amount: /"token_amount":([\d.]+)/,
    maker_address: /"maker_address":"(.*?)"/,
    price_sol: /"price_sol":([\d.]+)/,
    price_usd: /"price_usd":([\d.]+)/,
    total_sol: /"total_sol":([\d.]+)/,
    total_usd: /"total_usd":([\d.]+)/,
    created_at: /"created_at":"(.*?)"/,
    token_address: /"tokenAddress":"(.*?)"/,
    pair_address: /"pair_address":"(.*?)"/,
    token_name: /"tokenName":"(.*?)"/,
    token_code: /"tokenTicker":"(.*?)"/,
    protocol: /"protocol":"(.*?)"/,
  };

  for (const key in patterns) {
    const match = patterns[key].exec(data);
    if (match) {
      details[key] = match[1];
    }
  }
  return details;
}

async function buyToken(
  dex: string,
  name: string,
  address: string,
  solAmount: number,
  slippage: number
): Promise<void> {
  let attempts = 0;
  while (true) {
    try {
      await sleep(500);
      if (!allowRebuy && buyList.includes(address)) {
        console.log(`[${new Date().toLocaleString()}] Already bought [${dex.toUpperCase()}] "${name}" [${attempts}]!`);
        break;
      }
      if (attempts > maxBuyAttempts) {
        console.log(`[${new Date().toLocaleString()}] Already attempted to buy [${dex.toUpperCase()}] "${name}" [${attempts}]!`);
        break;
      }
      attempts++;
      console.log(`[${new Date().toLocaleString()}] Trying to buy [${dex.toUpperCase()}] "${name}" [${attempts}]..`);
      buyList.push(address);
      let bought: boolean = false;
      if (dex === 'ra') {
        bought = await buyRaydium(address, solAmount, slippage);
      } else {
        bought = await buyPumpFun(address, solAmount, slippage);
      }
      if (bought) {
        spent += solAmount;
        console.log(`[${new Date().toLocaleString()}] Bought [${dex.toUpperCase()}] "${name}" [${attempts}]!`);
        break;
      }
    } catch (e) {
      console.log(`[${new Date().toLocaleString()}] FAILED to buy [${dex.toUpperCase()}] "${name}" [${attempts}]!`);
    }
  }
}

async function sellToken(
  dex: string,
  name: string,
  address: string,
  slippage: number
): Promise<void> {
  let attempts = 0;
  while (true) {
    try {
      await sleep(500);
      console.log(`[${new Date().toLocaleString()}] Trying to sell [${dex.toUpperCase()}] "${name}" [${attempts}]..`);
      let sold: boolean | undefined;
      if (dex === 'ra') {
        sold = await sellRaydium(address, 100, slippage);
      } else {
        sold = await sellPumpFun(address, 100, slippage);
      }
      if (sold === undefined || sold) {
        break;
      }
      attempts++;
    } catch (e) {
      console.log(`[${new Date().toLocaleString()}] FAILED to sell [${dex.toUpperCase()}] "${name}" [${attempts}]! Trying again..`);
      attempts++;
    }
  }
}

async function sendPing(ws: WebSocket): Promise<void> {
  while (ws.readyState === WebSocket.OPEN) {
    await sleep(25000);
    if (debug) console.log('Sending PING..');
    const pingPayload = JSON.stringify({ method: "ping" });
    ws.send(pingPayload);
    if (debug) console.log('Sent', pingPayload);
  }
}

async function getCurrentBalance(): Promise<void> {
  while (true) {
    const balance = await getBalance();
    if (balance !== null) {
      const diff = balance - startBalance;
      startBalance = balance;
      if (diff !== 0.0) {
        console.log(`[${new Date().toLocaleString()}] Balance: ${startBalance} | Diff: ${diff.toFixed(9)}`);
      }
    }
    await sleep(5000);
  }
}

function filterMessages(msg: string): TransactionDetails | false {
  const regex = new RegExp(`.*(${trackWallets}).*`, 's');
  const match = regex.exec(msg);
  if (match) {
    return extractTransactionDetails(match[0]);
  }
  return false;
}

async function connect(): Promise<void> {
  while (true) {
    try {
      const headers: { [key: string]: string } = {
        'Origin': 'https://axiom.trade',
        'Cache-Control': 'no-cache',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Pragma': 'no-cache',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': 'NaBrA7Cq2xZiTicaYSIbTw==',
        'Cookie': readCookie(),
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits'
      };

      console.log(`[${new Date().toLocaleString()}] Connecting..`);
      const ws = new WebSocket('wss://cluster2.axiom.trade?', { headers });

      ws.on('open', () => {
        console.log(`[${new Date().toLocaleString()}] Connected! Sending payload...`);
        const payloads = loadInitialPayload();
        payloads.forEach((payload) => {
          ws.send(payload);
          if (debug) console.log('Sent', payload);
        });
        console.log(`[${new Date().toLocaleString()}] Payload sent!`);

        // Kick off periodic tasks
        sendPing(ws).catch(console.error);
        getCurrentBalance().catch(console.error);
      });

      ws.on('message', async (data: WebSocket.Data) => {
        // Assume data is string.
        const message = typeof data === 'string' ? data : data.toString();
        if (spent >= maxSolSpend) {
          console.log(`[${new Date().toLocaleString()}] Already spent ${spent}! Max: ${maxSolSpend}`);
          return;
        }
        const filtered = filterMessages(message);
        if (filtered) {
          const { transaction_type, protocol, maker_address, token_name, token_address, pair_address } = filtered;
          if (!maker_address || !maker_address.includes(trackWallets)) return;
          // Map protocols to functions
          const protocolMap: { [key: string]: { buy?: () => Promise<void>; sell?: () => Promise<void> } } = {
            'Pump V1': {
              sell: () => sellToken('pf', token_name || '', token_address || '', maxSlippage),
              buy: () => buyToken('pf', token_name || '', token_address || '', solIn, maxSlippage),
            },
            'Raydium V4': {
              sell: () => sellToken('ra', token_name || '', pair_address || '', maxSlippage),
              // Uncomment or implement buy if needed.
              // buy: () => buyToken('ra', token_name || '', token_address || '', solIn, maxSlippage),
            }
          };
          const action = protocolMap[protocol || '']?.[transaction_type || ''];
          if (!action) {
            console.log(`[${new Date().toLocaleString()}] Not supported ${transaction_type?.toUpperCase()}: ${protocol}! "${token_name}" : ${token_address}`);
            return;
          }
          await action();
        }
      });

      ws.on('close', async (code, reason) => {
        console.log(`[${new Date().toLocaleString()}] Connection closed: ${code} ${reason.toString()}. Trying to reconnect in 5 seconds...`);
        await refreshAccessToken();
        await sleep(5000);
      });

      ws.on('error', async (err) => {
        console.error(`[${new Date().toLocaleString()}] WebSocket error: ${err.message}`);
        ws.close();
      });

      // Wait here until connection is closed.
      await new Promise((resolve) => ws.on('close', resolve));
    } catch (e) {
      console.error(`[${new Date().toLocaleString()}] Error:`, e);
      break;
    }
  }
}

// --- Main Execution ---
(async () => {
  await refreshAccessToken();
  await connect();
})();
