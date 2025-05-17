const EXTENSION_TICKARRAY_BITMAP_SIZE = 14;

type Uint8Array32 = Uint8Array & { length: 32 };

// Helper type for 8-element array of BigInt
type Int64Array8 = [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

export interface TickArrayBitmapExtension {
  // Padding(8) - typically ignored in high-level TypeScript representation
  poolId: Uint8Array32; // 32 bytes
  positiveTickArrayBitmap: Int64Array8[]; // length: EXTENSION_TICKARRAY_BITMAP_SIZE
  negativeTickArrayBitmap: Int64Array8[]; // length: EXTENSION_TICKARRAY_BITMAP_SIZE
}

// Binary encoding/decoding helpers (conceptual examples)

// Parse 8 little-endian unsigned 64-bit integers
function parseInt64Array8(view: DataView, offset: number): { value: Int64Array8, newOffset: number } {
  const arr: bigint[] = [];
  for (let i = 0; i < 8; i++) {
    arr.push(view.getBigUint64(offset, true));
    offset += 8;
  }
  return { value: arr as Int64Array8, newOffset: offset };
}

// Parse TickArrayBitmapExtension from binary data
export function parseTickArrayBitmapExtension(buffer: ArrayBuffer): TickArrayBitmapExtension {
  const view = new DataView(buffer);

  let offset = 0;
  offset += 8; // Skip Padding(8)

  const poolIdArr = new Uint8Array(buffer, offset, 32) as Uint8Array32;
  offset += 32;

  const positiveTickArrayBitmap: Int64Array8[] = [];
  for (let i = 0; i < EXTENSION_TICKARRAY_BITMAP_SIZE; i++) {
    const parsed = parseInt64Array8(view, offset);
    positiveTickArrayBitmap.push(parsed.value);
    offset = parsed.newOffset;
  }

  const negativeTickArrayBitmap: Int64Array8[] = [];
  for (let i = 0; i < EXTENSION_TICKARRAY_BITMAP_SIZE; i++) {
    const parsed = parseInt64Array8(view, offset);
    negativeTickArrayBitmap.push(parsed.value);
    offset = parsed.newOffset;
  }

  return {
    poolId: poolIdArr,
    positiveTickArrayBitmap,
    negativeTickArrayBitmap,
  };
}
