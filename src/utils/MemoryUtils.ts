/**
 * Read multiple bytes from a storage array in little-endian order.
 * @param storage The byte array storage
 * @param addr Starting address
 * @param byteCount Number of bytes to read
 * @returns The combined value as bigint
 */
export function readBytesLE(
  storage: number[],
  addr: number,
  byteCount: number,
): bigint {
  let result = BigInt(0);
  for (let i = 0; i < byteCount; i++) {
    const byteAddr = (addr + i) & 0xff;
    const byteVal = BigInt(storage[byteAddr]);
    result |= byteVal << BigInt(i * 8);
  }
  return result;
}

/**
 * Write multiple bytes to a storage array in little-endian order.
 * @param storage The byte array storage
 * @param addr Starting address
 * @param value The value to write
 * @param byteCount Number of bytes to write
 */
export function writeBytesLE(
  storage: number[],
  addr: number,
  value: bigint,
  byteCount: number,
): void {
  for (let i = 0; i < byteCount; i++) {
    const byteAddr = (addr + i) & 0xff;
    const byteVal = Number((value >> BigInt(i * 8)) & BigInt(0xff));
    storage[byteAddr] = byteVal;
  }
}

/**
 * Get the list of affected addresses for multi-byte operations.
 * @param addr Starting address
 * @param byteCount Number of bytes
 * @returns Array of affected addresses (wrapped at 0xFF)
 */
export function getAffectedAddresses(
  addr: number,
  byteCount: number,
): number[] {
  const addresses: number[] = [];
  for (let i = 0; i < byteCount; i++) {
    addresses.push((addr + i) & 0xff);
  }
  return addresses;
}

/**
 * Calculate the center address for scrolling/display purposes.
 * @param addresses Array of addresses
 * @returns The middle address
 */
export function getCenterAddress(addresses: number[]): number {
  if (addresses.length === 0) return 0;
  const middleIndex = Math.floor((addresses.length - 1) / 2);
  return addresses[middleIndex];
}
