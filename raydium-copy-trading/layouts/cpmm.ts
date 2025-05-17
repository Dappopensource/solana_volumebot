import * as BufferLayout from '@solana/buffer-layout';
import BN from 'bn.js';

/* UInt128 helper functions and layout */
function decodeUInt128(buffer: Buffer): BN {
  const low = new BN(buffer.slice(0, 8), 'le');
  const high = new BN(buffer.slice(8, 16), 'le');
  return high.shln(64).add(low);
}

function encodeUInt128(num: BN): Buffer {
  const low = num.maskn(64).toArrayLike(Buffer, 'le', 8);
  const high = num.shrn(64).toArrayLike(Buffer, 'le', 8);
  return Buffer.concat([low, high]);
}

const UInt128Layout = (property?: string) => {
  const layout = BufferLayout.struct([
    BufferLayout.nu64('low'),
    BufferLayout.nu64('high')
  ], property);
  
  return {
    ...layout,
    decode: (buffer: Buffer, offset: number): BN => {
      const { low, high } = layout.decode(buffer, offset);
      return new BN(high).shln(64).add(new BN(low));
    },
    encode: (num: BN, buffer: Buffer, offset: number): number => {
      const high = num.shrn(64).toNumber();
      const low = num.maskn(64).toNumber();
      return layout.encode({ low, high }, buffer, offset);
    }
  };
};

/* CPMM_POOL_STATE_LAYOUT */
export const CPMM_POOL_STATE_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, 'padding'),
  BufferLayout.blob(32, 'amm_config'),
  BufferLayout.blob(32, 'pool_creator'),
  BufferLayout.blob(32, 'token_0_vault'),
  BufferLayout.blob(32, 'token_1_vault'), 
  BufferLayout.blob(32, 'lp_mint'),
  BufferLayout.blob(32, 'token_0_mint'),
  BufferLayout.blob(32, 'token_1_mint'),
  BufferLayout.blob(32, 'token_0_program'),
  BufferLayout.blob(32, 'token_1_program'),
  BufferLayout.blob(32, 'observation_key'),
  BufferLayout.u8('auth_bump'),
  BufferLayout.u8('status'),
  BufferLayout.u8('lp_mint_decimals'),
  BufferLayout.u8('mint_0_decimals'),
  BufferLayout.u8('mint_1_decimals'),
  BufferLayout.nu64('lp_supply'),
  BufferLayout.nu64('protocol_fees_token_0'),
  BufferLayout.nu64('protocol_fees_token_1'),
  BufferLayout.nu64('fund_fees_token_0'),
  BufferLayout.nu64('fund_fees_token_1'),
  BufferLayout.nu64('open_time'),
  BufferLayout.seq(BufferLayout.nu64(), 32, 'padding')
]);

/* AMM_CONFIG_LAYOUT */
export const AMM_CONFIG_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, 'padding'),
  BufferLayout.u8('bump'),
  BufferLayout.u8('disable_create_pool'), // Flag becomes u8
  BufferLayout.u16('index'),
  BufferLayout.nu64('trade_fee_rate'),
  BufferLayout.nu64('protocol_fee_rate'),
  BufferLayout.nu64('fund_fee_rate'),
  BufferLayout.nu64('create_pool_fee'),
  BufferLayout.blob(32, 'protocol_owner'),
  BufferLayout.blob(32, 'fund_owner'),
  BufferLayout.seq(BufferLayout.nu64(), 16, 'padding')
]);

/* OBSERVATION structure */
export const OBSERVATION_LAYOUT = BufferLayout.struct([
  BufferLayout.nu64('block_timestamp'),
  UInt128Layout('cumulative_token_0_price_x32'),
  UInt128Layout('cumulative_token_1_price_x32')
]);

/* OBSERVATION_STATE structure */
export const OBSERVATION_STATE_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, 'padding'),
  BufferLayout.u8('initialized'), // Flag becomes u8
  BufferLayout.u16('observationIndex'),
  BufferLayout.blob(32, 'poolId'),
  // For GreedyRange, we'll need to implement custom parsing logic
  // Here's a fixed-size array as placeholder:
  BufferLayout.seq(OBSERVATION_LAYOUT, 1000, 'observations'),
  BufferLayout.seq(BufferLayout.nu64(), 32, 'padding') // Fixed size padding
]);

// Types for the decoded structures
export interface CpmmPoolState {
  amm_config: Buffer;
  pool_creator: Buffer;
  token_0_vault: Buffer;
  token_1_vault: Buffer;
  lp_mint: Buffer;
  token_0_mint: Buffer;
  token_1_mint: Buffer;
  token_0_program: Buffer;
  token_1_program: Buffer;
  observation_key: Buffer;
  auth_bump: number;
  status: number;
  lp_mint_decimals: number;
  mint_0_decimals: number;
  mint_1_decimals: number;
  lp_supply: BN;
  protocol_fees_token_0: BN;
  protocol_fees_token_1: BN;
  fund_fees_token_0: BN;
  fund_fees_token_1: BN;
  open_time: BN;
}

export interface AmmConfig {
  bump: number;
  disable_create_pool: number;
  index: nu
