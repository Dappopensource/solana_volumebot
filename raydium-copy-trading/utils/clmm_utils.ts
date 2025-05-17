// Constants
const MIN_TICK = -443636;
const MAX_TICK = 443636;
const TICK_ARRAY_SIZE = 60;
const TICK_ARRAY_BITMAP_SIZE = 512;
const TOTAL_BITS = 1024;
const U1024_MASK = (BigInt(1) << BigInt(TOTAL_BITS)) - BigInt(1);

// Helper function to pack a 32‐bit signed integer in big‐endian format.
function packInt32BE(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(n, 0);
  return buf;
}

// Placeholder types – adjust these as needed.
type Pubkey = {
  toBuffer: () => Buffer;
  // stub for findProgramAddress
  // In practice, your library should supply an async method returning [Pubkey, number]
  // For this conversion we assume a synchronous call.
  // You can adapt these functions if findProgramAddress is asynchronous.
  // (For example, wrap these functions in an async helper.)
  // Here we use a static method below.
};

class Pubkey {
  // dummy internal representation; replace with your actual implementation.
  value: Buffer;
  constructor(value: Buffer) {
    this.value = value;
  }
  static async findProgramAddress(
    seeds: Buffer[],
    programId: Pubkey
  ): Promise<[Pubkey, number]> {
    // Dummy implementation; replace with your actual PDA derivation code.
    // For our purposes, we simply join the seeds.
    const combined = Buffer.concat(seeds);
    return [new Pubkey(combined), 0];
  }
}

// Assume RAYDIUM_CLMM is a Pubkey; adjust its type/import accordingly.
const RAYDIUM_CLMM = new Pubkey(Buffer.from("RaydiumCLMM"));

//
// Conversion of Python functions into TypeScript
//

// 1. load_current_and_next_tick_arrays -> loadCurrentAndNextTickArrays
export async function loadCurrentAndNextTickArrays(
  poolId: Pubkey,
  tickCurrent: number,
  tickSpacing: number,
  tickArrayBitmap: number[], // array of numbers (e.g. 16 × 64‐bit words for u1024)
  tickarrayBitmapExtension: [number[], number[]], // [positive: number[], negative: number[]]
  zeroForOne: boolean
): Promise<Pubkey[]> {
  // getFirstInitializedTickArray returns a tuple: [isInitialized, startIndex]
  let [initialized, currentValidTickArrayStartIndex] =
    getFirstInitializedTickArray(tickCurrent, tickSpacing, tickArrayBitmap, tickarrayBitmapExtension, zeroForOne);
  let tickArrayKeys: Pubkey[] = [];
  let initialKey = getPdaTickArrayAddress(poolId, currentValidTickArrayStartIndex);
  tickArrayKeys.push(initialKey);

  // Fetch up to 5 subsequent initialized tick arrays.
  for (let i = 0; i < 5; i++) {
    const nextTickArrayIndex = nextInitializedTickArrayStartIndex(
      tickArrayBitmap,
      tickarrayBitmapExtension,
      currentValidTickArrayStartIndex,
      tickSpacing,
      zeroForOne
    );
    if (nextTickArrayIndex === null) break;
    currentValidTickArrayStartIndex = nextTickArrayIndex;
    const nextKey = getPdaTickArrayAddress(poolId, currentValidTickArrayStartIndex);
    tickArrayKeys.push(nextKey);
  }
  return tickArrayKeys;
}

// 2. get_pda_tick_array_address -> getPdaTickArrayAddress
export function getPdaTickArrayAddress(poolId: Pubkey, startIndex: number): Pubkey {
  const seed = Buffer.concat([
    Buffer.from("tick_array"),
    poolId.toBuffer(),
    packInt32BE(startIndex),
  ]);
  // findProgramAddress returns a tuple [pda, bump]; we take the PDA.
  // If findProgramAddress is asynchronous, mark this function async.
  // For brevity we assume synchronous behavior or wrap in an async helper.
  // Here we use "await" inside an async immediate function.
  let pda: Pubkey;
  // In real code, use: const [pda] = await Pubkey.findProgramAddress(...)
  // For synchronous example:
  Pubkey.findProgramAddress([Buffer.from("tick_array"), poolId.toBuffer(), packInt32BE(startIndex)], RAYDIUM_CLMM)
    .then(([key]) => pda = key);
  // In this stub, we simply return a new Pubkey.
  return new Pubkey(seed);
}

// 3. get_pda_tick_array_bitmap_extension -> getPdaTickArrayBitmapExtension
export async function getPdaTickArrayBitmapExtension(poolId: Pubkey): Promise<Pubkey> {
  const [bitmapExtension] = await Pubkey.findProgramAddress(
    [Buffer.from("pool_tick_array_bitmap_extension"), poolId.toBuffer()],
    RAYDIUM_CLMM
  );
  return bitmapExtension;
}

// 4. next_initialized_tick -> nextInitializedTick
export function nextInitializedTick(
  currentTickIndex: number,
  tickSpacing: number,
  zeroForOne: boolean,
  tickArrayCurrent: { start_tick_index: number; ticks: { liquidity_gross: number }[] }
): { liquidity_gross: number } | null {
  const currentTickArrayStartIndex = getArrayStartIndex(currentTickIndex, tickSpacing);
  const startTickIndex = tickArrayCurrent.start_tick_index;
  if (currentTickArrayStartIndex !== startTickIndex) {
    return null;
  }
  let offsetInArray = Math.floor((currentTickIndex - startTickIndex) / tickSpacing);
  if (zeroForOne) {
    while (offsetInArray >= 0) {
      const tick = tickArrayCurrent.ticks[offsetInArray];
      if (tick !== undefined && tick.liquidity_gross !== 0) {
        return tick;
      }
      offsetInArray--;
    }
  } else {
    offsetInArray++;
    while (offsetInArray < tickArrayCurrent.ticks.length) {
      const tick = tickArrayCurrent.ticks[offsetInArray];
      if (tick !== undefined && tick.liquidity_gross !== 0) {
        return tick;
      }
      offsetInArray++;
    }
  }
  return null;
}

// 5. get_first_initialized_tick_array -> getFirstInitializedTickArray
// Returns a tuple: [isInitialized: boolean, startIndex: number]
export function getFirstInitializedTickArray(
  tickCurrent: number,
  tickSpacing: number,
  tickArrayBitmap: number[],
  tickarrayBitmapExtension: [number[], number[]],
  zeroForOne: boolean
): [boolean, number] {
  const tickArrayStartIndex = getArrayStartIndex(tickCurrent, tickSpacing);
  if (isOverflowDefaultTickarrayBitmap([tickCurrent], tickSpacing)) {
    const [initialized, startIndex] = checkTickArrayIsInitialized(tickArrayStartIndex, tickSpacing, tickarrayBitmapExtension);
    if (initialized) return [true, startIndex];
  } else {
    const u1024Bitmap = bitmapListToU1024(tickArrayBitmap);
    const [initialized, startIndex] = checkCurrentTickArrayIsInitialized(u1024Bitmap, tickCurrent, tickSpacing);
    if (initialized) return [true, startIndex];
  }
  const nextStartIndex = nextInitializedTickArrayStartIndex(tickArrayBitmap, tickarrayBitmapExtension, tickArrayStartIndex, tickSpacing, zeroForOne);
  return [false, nextStartIndex === null ? tickArrayStartIndex : nextStartIndex];
}

// 6. is_overflow_default_tickarray_bitmap -> isOverflowDefaultTickarrayBitmap
export function isOverflowDefaultTickarrayBitmap(tickIndices: number[], tickSpacing: number): boolean {
  function tickArrayStartIndexRange(tickSpacing: number): [number, number] {
    let maxTickBoundary = tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE;
    let minTickBoundary = -maxTickBoundary;
    if (maxTickBoundary > MAX_TICK) {
      maxTickBoundary = getArrayStartIndex(MAX_TICK, tickSpacing) + tickCount(tickSpacing);
    }
    if (minTickBoundary < MIN_TICK) {
      minTickBoundary = getArrayStartIndex(MIN_TICK, tickSpacing);
    }
    return [minTickBoundary, maxTickBoundary];
  }
  const [minBound, maxBound] = tickArrayStartIndexRange(tickSpacing);
  for (const tickIndex of tickIndices) {
    const tickArrayStartIndex = getArrayStartIndex(tickIndex, tickSpacing);
    if (tickArrayStartIndex >= maxBound || tickArrayStartIndex < minBound) {
      return true;
    }
  }
  return false;
}

// 7. check_tick_array_is_initialized -> checkTickArrayIsInitialized
// Returns [initialized: boolean, tickArrayStartIndex: number]
export function checkTickArrayIsInitialized(
  tickArrayStartIndex: number,
  tickSpacing: number,
  tickarrayBitmapExtension: [number[], number[]]
): [boolean, number] {
  function calcTickArrayOffsetInBitmap(tickArrayStartIndex: number, tickSpacing: number): number {
    const m = Math.abs(tickArrayStartIndex) % (tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE);
    let tickArrayOffset = Math.floor(m / (TICK_ARRAY_SIZE * tickSpacing));
    if (tickArrayStartIndex < 0 && m !== 0) {
      tickArrayOffset = TICK_ARRAY_BITMAP_SIZE - tickArrayOffset;
    }
    return tickArrayOffset;
  }
  const [positiveBitmap, negativeBitmap] = tickarrayBitmapExtension;
  const [_, bitmap] = getBitmap(tickArrayStartIndex, tickSpacing, positiveBitmap, negativeBitmap);
  const tickArrayOffset = calcTickArrayOffsetInBitmap(tickArrayStartIndex, tickSpacing);
  // Reconstruct 512-bit value from bitmap parts. Each part is 64 bits.
  let u512 = BigInt(0);
  for (let i = 0; i < bitmap.length; i++) {
    // Overwrite at offset (7 - i)*64.
    u512 |= BigInt(bitmap[i]) << BigInt((7 - i) * 64);
  }
  // Check the bit at position tickArrayOffset (from LSB)
  const bit = (u512 >> BigInt(tickArrayOffset)) & BigInt(1);
  const initialized = (bit === BigInt(1));
  return [initialized, tickArrayStartIndex];
}

// 8. bitmap_list_to_u1024 -> bitmapListToU1024
export function bitmapListToU1024(bitmapList: number[]): bigint {
  if (bitmapList.length !== 16) {
    throw new Error("Bitmap list must have exactly 16 elements.");
  }
  let result = BigInt(0);
  for (let i = 0; i < bitmapList.length; i++) {
    result += BigInt(bitmapList[i]) << BigInt(64 * i);
  }
  return result;
}

// 9. check_current_tick_array_is_initialized -> checkCurrentTickArrayIsInitialized
// Returns [initialized: boolean, resultTick: number]
export function checkCurrentTickArrayIsInitialized(
  bitMap: bigint,
  tickCurrent: number,
  tickSpacing: number
): [boolean, number] {
  const multiplier = tickSpacing * TICK_ARRAY_SIZE;
  let compressed = Math.floor(tickCurrent / multiplier) + 512;
  if (tickCurrent < 0 && (tickCurrent % multiplier) !== 0) {
    compressed -= 1;
  }
  const bitPos = Math.abs(compressed);
  const mask = BigInt(1) << BigInt(bitPos);
  const masked = bitMap & mask;
  const initialized = (masked !== BigInt(0));
  const resultTick = (compressed - 512) * multiplier;
  return [initialized, resultTick];
}

// 10. next_initialized_tick_array_start_index -> nextInitializedTickArrayStartIndex
export function nextInitializedTickArrayStartIndex(
  tickArrayBitmap: number[],
  tickarrayBitmapExtension: [number[], number[]],
  lastTickArrayStartIndex: number,
  tickSpacing: number,
  zeroForOne: boolean
): number | null {
  lastTickArrayStartIndex = getArrayStartIndex(lastTickArrayStartIndex, tickSpacing);
  let iteration = 0;
  while (true) {
    iteration++;
    const [found, startIndex] = nextInitializedTickArrayStartIndexInBitmap(
      u1024FromList(tickArrayBitmap),
      lastTickArrayStartIndex,
      tickSpacing,
      zeroForOne
    );
    if (found) {
      return startIndex;
    }
    lastTickArrayStartIndex = startIndex;
    const [found2, startIndex2] = nextInitializedTickArrayFromOneBitmap(
      lastTickArrayStartIndex,
      tickSpacing,
      zeroForOne,
      tickarrayBitmapExtension
    );
    if (found2) {
      return startIndex2;
    }
    lastTickArrayStartIndex = startIndex2;
    if (lastTickArrayStartIndex < MIN_TICK || lastTickArrayStartIndex > MAX_TICK) {
      return null;
    }
  }
}

// 11. u1024_from_list -> u1024FromList
export function u1024FromList(words: number[]): bigint {
  let value = BigInt(0);
  for (let i = 0; i < words.length; i++) {
    value |= BigInt(words[i]) << BigInt(64 * i);
  }
  return value & U1024_MASK;
}

// 12. max_tick_in_tickarray_bitmap -> maxTickInTickarrayBitmap
export function maxTickInTickarrayBitmap(tickSpacing: number): number {
  return tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE;
}

// 13. most_significant_bit -> mostSignificantBit
export function mostSignificantBit(x: bigint): number | null {
  if (x === BigInt(0)) return null;
  // Use string representation in base 2
  const bitLength = x.toString(2).length;
  return TOTAL_BITS - bitLength;
}

// 14. least_significant_bit -> leastSignificantBit
export function leastSignificantBit(x: bigint): number | null {
  if (x === BigInt(0)) return null;
  // (x & -x) isolates the lowest set bit.
  return ( (x & -x).toString(2).length ) - 1;
}

// 15. next_initialized_tick_array_start_index_in_bitmap -> nextInitializedTickArrayStartIndexInBitmap
export function nextInitializedTickArrayStartIndexInBitmap(
  bitMap: bigint,
  lastTickArrayStartIndex: number,
  tickSpacing: number,
  zeroForOne: boolean
): [boolean, number] {
  // Ensure bitMap is masked correctly.
  bitMap &= U1024_MASK;
  const tickBoundary = maxTickInTickarrayBitmap(tickSpacing);
  let nextTickArrayStartIndex: number;
  if (zeroForOne) {
    nextTickArrayStartIndex = lastTickArrayStartIndex - tickCount(tickSpacing);
  } else {
    nextTickArrayStartIndex = lastTickArrayStartIndex + tickCount(tickSpacing);
  }
  if (nextTickArrayStartIndex < -tickBoundary || nextTickArrayStartIndex >= tickBoundary) {
    return [false, lastTickArrayStartIndex];
  }
  const multiplier = tickSpacing * TICK_ARRAY_SIZE;
  let compressed = Math.floor(nextTickArrayStartIndex / multiplier) + 512;
  if (nextTickArrayStartIndex < 0 && (nextTickArrayStartIndex % multiplier) !== 0) {
    compressed -= 1;
  }
  const bitPos = Math.abs(compressed);
  if (zeroForOne) {
    const shiftAmount = BigInt(TOTAL_BITS - bitPos - 1);
    const offsetBitMap = (bitMap << shiftAmount) & U1024_MASK;
    const nextBit = mostSignificantBit(offsetBitMap);
    if (nextBit !== null) {
      const nextArrayStartIndex = (bitPos - nextBit - 512) * multiplier;
      return [true, nextArrayStartIndex];
    } else {
      return [false, -tickBoundary];
    }
  } else {
    const offsetBitMap = bitMap >> BigInt(bitPos);
    const nextBit = leastSignificantBit(offsetBitMap);
    if (nextBit !== null) {
      const nextArrayStartIndex = (bitPos + nextBit - 512) * multiplier;
      return [true, nextArrayStartIndex];
    } else {
      const fallback = tickBoundary - tickCount(tickSpacing);
      return [false, fallback];
    }
  }
}

// 16. next_initialized_tick_array_from_one_bitmap -> nextInitializedTickArrayFromOneBitmap
export function nextInitializedTickArrayFromOneBitmap(
  lastTickArrayStartIndex: number,
  tickSpacing: number,
  zeroForOne: boolean,
  tickarrayBitmapExtension: [number[], number[]]
): [boolean, number] {
  const multiplier = tickCount(tickSpacing);
  let nextTickArrayStartIndex: number;
  if (zeroForOne) {
    nextTickArrayStartIndex = lastTickArrayStartIndex - multiplier;
  } else {
    nextTickArrayStartIndex = lastTickArrayStartIndex + multiplier;
  }
  const minTickArrayStartIndex = getArrayStartIndex(MIN_TICK, tickSpacing);
  const maxTickArrayStartIndex = getArrayStartIndex(MAX_TICK, tickSpacing);
  if (nextTickArrayStartIndex < minTickArrayStartIndex || nextTickArrayStartIndex > maxTickArrayStartIndex) {
    return [false, nextTickArrayStartIndex];
  }
  const [positiveBitmap, negativeBitmap] = tickarrayBitmapExtension;
  const [_, tickarrayBitmap] = getBitmap(nextTickArrayStartIndex, tickSpacing, positiveBitmap, negativeBitmap);
  return nextInitializedTickArrayInBitmap(tickarrayBitmap, nextTickArrayStartIndex, tickSpacing, zeroForOne);
}

// 17. next_initialized_tick_array_in_bitmap -> nextInitializedTickArrayInBitmap
export function nextInitializedTickArrayInBitmap(
  tickarrayBitmap: number[],
  nextTickArrayStartIndex: number,
  tickSpacing: number,
  zeroForOne: boolean
): [boolean, number] {
  function u512IsZero(x: bigint): boolean {
    return x === BigInt(0);
  }
  function u512LeadingZeros(x: bigint): number {
    if (x === BigInt(0)) return 512;
    return 512 - x.toString(2).length;
  }
  function u512TrailingZeros(x: bigint): number {
    if (x === BigInt(0)) return 512;
    return ((x & -x).toString(2).length) - 1;
  }
  function calcTickArrayOffsetInBitmap(tickArrayStartIndex: number, tickSpacing: number): number {
    const m = Math.abs(tickArrayStartIndex) % (tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE);
    let offset = Math.floor(m / (TICK_ARRAY_SIZE * tickSpacing));
    if (tickArrayStartIndex < 0 && m !== 0) {
      offset = TICK_ARRAY_BITMAP_SIZE - offset;
    }
    return offset;
  }
  function getBitmapTickBoundary(tickArrayStartIndex: number, tickSpacing: number): [number, number] {
    const ticksInOneBitmap = tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE;
    let m = Math.floor(Math.abs(tickArrayStartIndex) / ticksInOneBitmap);
    if (tickArrayStartIndex < 0 && Math.abs(tickArrayStartIndex) % ticksInOneBitmap !== 0) {
      m += 1;
    }
    const minValue = ticksInOneBitmap * m;
    if (tickArrayStartIndex < 0) {
      return [-minValue, -minValue + ticksInOneBitmap];
    } else {
      return [minValue, minValue + ticksInOneBitmap];
    }
  }
  const [bitmapMinBoundary, bitmapMaxBoundary] = getBitmapTickBoundary(nextTickArrayStartIndex, tickSpacing);
  const tickArrayOffset = calcTickArrayOffsetInBitmap(nextTickArrayStartIndex, tickSpacing);
  // Reconstruct u512 from tickarrayBitmap parts (each is 64 bits).
  let u512TickarrayBitmap = BigInt(0);
  for (let i = 0; i < tickarrayBitmap.length; i++) {
    u512TickarrayBitmap |= BigInt(tickarrayBitmap[i]) << BigInt((7 - i) * 64);
  }
  if (zeroForOne) {
    const offsetBitMap = (u512TickarrayBitmap << BigInt(TICK_ARRAY_BITMAP_SIZE - 1 - tickArrayOffset)) & ((BigInt(1) << BigInt(TICK_ARRAY_BITMAP_SIZE)) - BigInt(1));
    const offsetInt = offsetBitMap;
    let nextBit: number | null = null;
    if (u512IsZero(offsetInt)) {
      nextBit = null;
    } else {
      nextBit = u512LeadingZeros(offsetInt);
    }
    if (nextBit !== null) {
      const nextArrayStartIndex = nextTickArrayStartIndex - nextBit * tickCount(tickSpacing);
      return [true, nextArrayStartIndex];
    } else {
      return [false, bitmapMinBoundary];
    }
  } else {
    const offsetBitMap = u512TickarrayBitmap >> BigInt(tickArrayOffset);
    const offsetInt = offsetBitMap;
    let nextBit: number | null = null;
    if (u512IsZero(offsetInt)) {
      nextBit = null;
    } else {
      nextBit = u512TrailingZeros(offsetInt);
    }
    if (nextBit !== null) {
      const nextArrayStartIndex = nextTickArrayStartIndex + nextBit * tickCount(tickSpacing);
      return [true, nextArrayStartIndex];
    } else {
      return [false, bitmapMaxBoundary - tickCount(tickSpacing)];
    }
  }
}

// 18. get_bitmap -> getBitmap
// Returns a tuple: [offset: number, bitmap: number[]]
// Here, positiveBitmap and negativeBitmap are arrays of numbers.
export function getBitmap(
  tickIndex: number,
  tickSpacing: number,
  positiveBitmap: number[],
  negativeBitmap: number[]
): [number, number[]] {
  const ticksInOneBitmap = tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE;
  let offset = Math.floor(Math.abs(tickIndex) / ticksInOneBitmap) - 1;
  if (tickIndex < 0 && Math.abs(tickIndex) % ticksInOneBitmap === 0) {
    offset -= 1;
  }
  if (tickIndex < 0) {
    return [offset, negativeBitmap[offset]];
  } else {
    return [offset, positiveBitmap[offset]];
  }
}

// 19. tick_count -> tickCount
export function tickCount(tickSpacing: number): number {
  return TICK_ARRAY_SIZE * tickSpacing;
}

// 20. get_array_start_index -> getArrayStartIndex
export function getArrayStartIndex(tickIndex: number, tickSpacing: number): number {
  const ticksInArray = tickCount(tickSpacing);
  let start = Math.floor(tickIndex / ticksInArray);
  if (tickIndex < 0 && tickIndex % ticksInArray !== 0) {
    start -= 1;
  }
  return start * ticksInArray;
}
