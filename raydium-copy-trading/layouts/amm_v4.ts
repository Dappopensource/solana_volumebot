import * as BufferLayout from '@solana/buffer-layout';
import BN from 'bn.js';

/**
 * Helper: define a layout representing an unsigned 64-bit integer.
 * The value is stored as an 8-byte blob that you can convert to BN.
 */
export const uint64 = (property?: string) =>
  BufferLayout.blob(8, property);

/**
 * LIQUIDITY_STATE_LAYOUT_V4
 * This layout follows the order and types of the original Construct schema.
 */
export const LIQUIDITY_STATE_LAYOUT_V4 = BufferLayout.struct([
  uint64('status'),
  uint64('nonce'),
  uint64('orderNum'),
  uint64('depth'),
  uint64('coinDecimals'),
  uint64('pcDecimals'),
  uint64('state'),
  uint64('resetFlag'),
  uint64('minSize'),
  uint64('volMaxCutRatio'),
  uint64('amountWaveRatio'),
  uint64('coinLotSize'),
  uint64('pcLotSize'),
  uint64('minPriceMultiplier'),
  uint64('maxPriceMultiplier'),
  uint64('systemDecimalsValue'),
  uint64('minSeparateNumerator'),
  uint64('minSeparateDenominator'),
  uint64('tradeFeeNumerator'),
  uint64('tradeFeeDenominator'),
  uint64('pnlNumerator'),
  uint64('pnlDenominator'),
  uint64('swapFeeNumerator'),
  uint64('swapFeeDenominator'),
  uint64('needTakePnlCoin'),
  uint64('needTakePnlPc'),
  uint64('totalPnlPc'),
  uint64('totalPnlCoin'),
  uint64('poolOpenTime'),
  uint64('punishPcAmount'),
  uint64('punishCoinAmount'),
  uint64('orderbookToInitTime'),
  // For BytesInteger(16, signed=false, swapped=true) we use a 16-byte blob.
  BufferLayout.blob(16, 'swapCoinInAmount'),
  BufferLayout.blob(16, 'swapPcOutAmount'),
  uint64('swapCoin2PcFee'),
  BufferLayout.blob(16, 'swapPcInAmount'),
  BufferLayout.blob(16, 'swapCoinOutAmount'),
  uint64('swapPc2CoinFee'),
  BufferLayout.blob(32, 'poolCoinTokenAccount'),
  BufferLayout.blob(32, 'poolPcTokenAccount'),
  BufferLayout.blob(32, 'coinMintAddress'),
  BufferLayout.blob(32, 'pcMintAddress'),
  BufferLayout.blob(32, 'lpMintAddress'),
  BufferLayout.blob(32, 'ammOpenOrders'),
  BufferLayout.blob(32, 'serumMarket'),
  BufferLayout.blob(32, 'serumProgramId'),
  BufferLayout.blob(32, 'ammTargetOrders'),
  BufferLayout.blob(32, 'poolWithdrawQueue'),
  BufferLayout.blob(32, 'poolTempLpTokenAccount'),
  BufferLayout.blob(32, 'ammOwner'),
  BufferLayout.blob(32, 'pnlOwner'),
]);

/**
 * ACCOUNT_FLAGS_LAYOUT
 * Originally defined as a bit‑structured layout with seven flag fields and 57 padding bits.
 * Here we choose to store the 8 bytes as a single blob; later you can decode the individual bit flags.
 */
export const ACCOUNT_FLAGS_LAYOUT = BufferLayout.blob(8, 'accountFlags');

/**
 * MARKET_STATE_LAYOUT_V3
 */
export const MARKET_STATE_LAYOUT_V3 = BufferLayout.struct([
  BufferLayout.blob(5, 'padding1'),
  ACCOUNT_FLAGS_LAYOUT, // 8 bytes for account flags
  BufferLayout.blob(32, 'own_address'),
  uint64('vault_signer_nonce'),
  BufferLayout.blob(32, 'base_mint'),
  BufferLayout.blob(32, 'quote_mint'),
  BufferLayout.blob(32, 'base_vault'),
  uint64('base_deposits_total'),
  uint64('base_fees_accrued'),
  BufferLayout.blob(32, 'quote_vault'),
  uint64('quote_deposits_total'),
  uint64('quote_fees_accrued'),
  uint64('quote_dust_threshold'),
  BufferLayout.blob(32, 'request_queue'),
  BufferLayout.blob(32, 'event_queue'),
  BufferLayout.blob(32, 'bids'),
  BufferLayout.blob(32, 'asks'),
  uint64('base_lot_size'),
  uint64('quote_lot_size'),
  uint64('fee_rate_bps'),
  uint64('referrer_rebate_accrued'),
  BufferLayout.blob(7, 'padding2'),
]);

/**
 * OPEN_ORDERS_LAYOUT
 */
export const OPEN_ORDERS_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(5, 'padding1'),
  ACCOUNT_FLAGS_LAYOUT,
  BufferLayout.blob(32, 'market'),
  BufferLayout.blob(32, 'owner'),
  uint64('base_token_free'),
  uint64('base_token_total'),
  uint64('quote_token_free'),
  uint64('quote_token_total'),
  BufferLayout.blob(16, 'free_slot_bits'),
  BufferLayout.blob(16, 'is_bid_bits'),
  // For orders, we replicate a 16-byte blob 128 times.
  BufferLayout.seq(BufferLayout.blob(16), 128, 'orders'),
  // For client_ids, we replicate a uint64 128 times.
  BufferLayout.seq(uint64(), 128, 'client_ids'),
  uint64('referrer_rebate_accrued'),
  BufferLayout.blob(7, 'padding2'),
]);

/**
 * SWAP_LAYOUT
 */
export const SWAP_LAYOUT = BufferLayout.struct([
  BufferLayout.u8('instruction'),
  uint64('amount_in'),
  uint64('min_amount_out'),
]);

/**
 * PUBLIC_KEY_LAYOUT
 */
export const PUBLIC_KEY_LAYOUT = BufferLayout.blob(32, 'publicKey');

/**
 * ACCOUNT_LAYOUT
 */
export const ACCOUNT_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(32, 'mint'),
  BufferLayout.blob(32, 'owner'),
  uint64('amount'),
  BufferLayout.u32('delegate_option'),
  BufferLayout.blob(32, 'delegate'),
  BufferLayout.u8('state'),
  BufferLayout.u32('is_native_option'),
  uint64('is_native'),
  uint64('delegated_amount'),
  BufferLayout.u32('close_authority_option'),
  BufferLayout.blob(32, 'close_authority'),
]);
