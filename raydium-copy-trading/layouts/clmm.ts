import * as BufferLayout from '@solana/buffer-layout';
import BN from 'bn.js';

/* Helper functions for UInt128 conversion.
   UInt128 is represented as 16 bytes in little‐endian order:
   first 8 bytes: low part, next 8 bytes: high part.
*/
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

/* UInt128 layout adapter:
   Wraps a 16-byte blob layout with a custom decode/encode.
*/
export const UInt128Layout = (property?: string) => {
  const blob = BufferLayout.blob(16, property);
  return Object.assign(blob, {
    decode(b: Buffer, offset = 0): BN {
      const buf = blob.decode(b, offset) as Buffer;
      return decodeUInt128(buf);
    },
    encode(src: BN, b: Buffer, offset = 0): number {
      const buf = encodeUInt128(src);
      return blob.encode(buf, b, offset);
    }
  });
};

/* OBSERVATION structure */
export const OBSERVATION_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, 'block_timestamp'), // Int64ul (8 bytes)
  UInt128Layout('cumulative_token_0_price_x32'),
  UInt128Layout('cumulative_token_1_price_x32')
]);

/* AMM_CONFIG_LAYOUT structure */
export const AMM_CONFIG_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, 'padding'),
  BufferLayout.u8('bump'),
  BufferLayout.u16('index'),
  BufferLayout.blob(32, 'owner'),
  BufferLayout.u32('protocol_fee_rate'),
  BufferLayout.u32('trade_fee_rate'),
  BufferLayout.u16('tick_spacing'),
  BufferLayout.u32('fund_fee_rate'),
  BufferLayout.u32('padding_u32'),
  BufferLayout.blob(32, 'fund_owner'),
  // An array of three 8-byte unsigned ints.
  BufferLayout.seq(BufferLayout.blob(8), 3, 'padding')
]);

/* OBSERVATION_STATE_LAYOUT structure */
export const OBSERVATION_STATE_LAYOUT = BufferLayout.struct([
  // Flag: we use 1 byte to represent a boolean.
  BufferLayout.u8('initialized'),
  BufferLayout.blob(32, 'pool_id'),
  // Array of 1000 OBSERVATIONs.
  BufferLayout.seq(OBSERVATION_LAYOUT, 1000, 'observations'),
  // Array of 5 UInt128 values.
  BufferLayout.seq(UInt128Layout(), 5, 'padding')
]);

/* POSITION_REWARD_INFO structure */
export const POSITION_REWARD_INFO_LAYOUT = BufferLayout.struct([
  UInt128Layout('reward_amount'),
  UInt128Layout('reward_growth_inside')
]);

/* PERSONAL_POSITION_STATE_LAYOUT structure */
export const PERSONAL_POSITION_STATE_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, 'padding'),
  BufferLayout.u8('bump'),
  BufferLayout.blob(32, 'nft_mint'),
  BufferLayout.blob(32, 'pool_id'),
  // For signed 32-bit integers, use a custom s32 layout if necessary.
  BufferLayout.s32('tick_lower_index'),
  BufferLayout.s32('tick_upper_index'),
  UInt128Layout('liquidity'),
  UInt128Layout('fee_growth_inside_0_last_x64'),
  UInt128Layout('fee_growth_inside_1_last_x64'),
  BufferLayout.blob(8, 'token_fees_owed_0'), // Int64ul as 8-byte blob
  BufferLayout.blob(8, 'token_fees_owed_1'),
  // Array of 3 POSITION_REWARD_INFO
  BufferLayout.seq(POSITION_REWARD_INFO_LAYOUT, 3, 'reward_infos'),
  // Array of 8 Int64ul values (8 bytes each)
  BufferLayout.seq(BufferLayout.blob(8), 8, 'padding')
]);

/* CLMM_POOL_STATE_LAYOUT structure */
export const CLMM_POOL_STATE_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, 'padding'),
  BufferLayout.u8('bump'),
  BufferLayout.blob(32, 'amm_config'),
  BufferLayout.blob(32, 'owner'),
  BufferLayout.blob(32, 'token_mint_0'),
  BufferLayout.blob(32, 'token_mint_1'),
  BufferLayout.blob(32, 'token_vault_0'),
  BufferLayout.blob(32, 'token_vault_1'),
  BufferLayout.blob(32, 'observation_key'),
  BufferLayout.u8('mint_decimals_0'),
  BufferLayout.u8('mint_decimals_1'),
  BufferLayout.u16('tick_spacing'),
  UInt128Layout('liquidity'),
  UInt128Layout('sqrt_price_x64'),
  BufferLayout.s32('tick_current'),
  BufferLayout.u16('observation_index'),
  BufferLayout.u16('observation_update_duration'),
  UInt128Layout('fee_growth_global_0_x64'),
  UInt128Layout('fee_growth_global_1_x64'),
  BufferLayout.blob(8, 'protocol_fees_token_0'),
  BufferLayout.blob(8, 'protocol_fees_token_1'),
  UInt128Layout('swap_in_amount_token_0'),
  UInt128Layout('swap_out_amount_token_1'),
  UInt128Layout('swap_in_amount_token_1'),
  UInt128Layout('swap_out_amount_token_0'),
  BufferLayout.u8('status'),
  BufferLayout.blob(7, 'padding_before_bitmap'),
  // Skip decoding of unknown 507-byte block:
  BufferLayout.blob(507, 'skipped'),
  // Array of 16 Int64ul values
  BufferLayout.seq(BufferLayout.blob(8), 16, 'tick_array_bitmap'),
  BufferLayout.blob(8, 'total_fees_token_0'),
  BufferLayout.blob(8, 'total_fees_claimed_token_0'),
  BufferLayout.blob(8, 'total_fees_token_1'),
  BufferLayout.blob(8, 'total_fees_claimed_token_1'),
  BufferLayout.blob(8, 'fund_fees_token_0'),
  BufferLayout.blob(8, 'fund_fees_token_1'),
  BufferLayout.seq(BufferLayout.blob(8), 26, 'padding1'),
  BufferLayout.seq(BufferLayout.blob(8), 32, 'padding2')
]);

/* TICK_ARRAY_STATE_LAYOUT structure */
export const TICK_ARRAY_STATE_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(32, 'pool_id'),
  BufferLayout.s32('start_tick_index'),
  // ticks is an array of 60 elements, each is a struct.
  BufferLayout.seq(
    BufferLayout.struct([
      BufferLayout.s32('tick_index'),
      BufferLayout.blob(8, 'liquidity_net'),
      UInt128Layout('liquidity_gross')
    ]),
    60,
    'ticks'
  ),
  BufferLayout.u8('initialized_tick_count'),
  BufferLayout.seq(BufferLayout.u8(), 115, 'padding')
]);

/* PROTOCOL_POSITION_STATE_LAYOUT structure */
export const PROTOCOL_POSITION_STATE_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, 'padding'),
  BufferLayout.u8('bump'),
  BufferLayout.blob(32, 'pool_id'),
  BufferLayout.s32('tick_lower_index'),
  BufferLayout.s32('tick_upper_index'),
  UInt128Layout('liquidity'),
  UInt128Layout('fee_growth_inside_0_last_x64'),
  UInt128Layout('fee_growth_inside_1_last_x64'),
  BufferLayout.blob(8, 'token_fees_owed_0'),
  BufferLayout.blob(8, 'token_fees_owed_1'),
  BufferLayout.seq(UInt128Layout(), 3, 'reward_growth_inside'),
  BufferLayout.seq(BufferLayout.blob(8), 8, 'padding')
]);
