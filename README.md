# Axiom trading bots

Axiom trading bots is api information about axiom.trade and using them to copy trade on raydium and pumpfun


## Contract

If you wanna built more speed and profitable trading tools, contact here: [Telegram](https://t.me/vicckr) | [Twitter](https://x.com/divi-code)


## Disclaimer

- This project is not affiliated with Axiom.trade, and they do not endorse or support it in any way.

- This is not an official product of Axiom.trade.

- The bot has not been extensively tested, and I do not take responsibility for any losses incurred while using it.

- I do not recommend putting money on it. Use it at your own risk.

- The Raydium BUY transaction is disabled by default because it has not been tested yet. See below for enabling it.
  

## Environment Variables Explanation

- RPC_URL_PUMP_FUN: The RPC URL used for transactions on Pump.fun.

- RPC_URL_RAYDIUM: The RPC URL used for transactions on Raydium.

- WALLET_PUBLIC_KEY: Your Solana wallet public key.

- WALLET_PRIVATE_KEY: Your private key in Base58 format (can be extracted from Phantom Wallet - Guide).

- TRACK_WALLETS: Wallets to track for copy trading. Multiple wallets can be separated using | (e.g., wallet1|wallet2|wallet3).

- SOL_IN: The fixed amount of SOL to use for each buy order.

- MAX_SOL_SPEND: The maximum amount of SOL that can be spent while the bot is running. If set to 0, there is no limit.

- MAX_SLIPPAGE: The maximum slippage allowed for transactions before they fail.

- ALLOW_REBUY: Defines whether the bot is allowed to rebuy the same token (true or false).

- MAX_BUY_ATTEMPTS: The maximum number of times the bot will retry a failed buy transaction before giving up.
DEBUG: If set to true, it enables detailed logs, including packet logs from WebSockets, for debugging purposes.
