import {
  RequestPacket,
  ResponsePacket,
  ReadRequest,
  WriteRequest,
  ReadResponse,
  WriteResponse,
} from '../schemes/PacketScheme';

/**
 * Calculates the byte count from size field.
 * size=0 -> 1 byte, size=1 -> 2 bytes, size=2 -> 4 bytes, size=3 -> 8 bytes, etc.
 */
export function getSizeInBytes(size: number): number {
  return 1 << size; // 2^size
}

/**
 * Type guard to check if a packet is a read request.
 */
export function isReadRequest(packet: RequestPacket): packet is ReadRequest {
  return packet.type === 'read';
}

/**
 * Type guard to check if a packet is a write request.
 */
export function isWriteRequest(packet: RequestPacket): packet is WriteRequest {
  return packet.type === 'write';
}

/**
 * Type guard to check if a packet is a read response.
 */
export function isReadResponse(packet: ResponsePacket): packet is ReadResponse {
  return packet.type === 'read';
}

/**
 * Type guard to check if a packet is a write response.
 */
export function isWriteResponse(packet: ResponsePacket): packet is WriteResponse {
  return packet.type === 'write';
}

/**
 * Utility function to format an 8-bit address as hex string.
 */
export function formatAddr(addr: number): string {
  return '0x' + (addr & 0xFF).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Utility function to format an 8-bit value as hex string.
 */
export function formatValue(value: number): string {
  return '0x' + (value & 0xFF).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Utility function to format a multi-byte value as hex string.
 * @param value The value to format (bigint for large values)
 * @param size The size field (0=1B, 1=2B, 2=4B, 3=8B)
 */
export function formatMultiByteValue(value: bigint, size: number): string {
  const byteCount = getSizeInBytes(size);
  const hexDigits = byteCount * 2;
  const mask = (BigInt(1) << BigInt(byteCount * 8)) - BigInt(1);
  const maskedValue = value & mask;
  return '0x' + maskedValue.toString(16).toUpperCase().padStart(hexDigits, '0');
}

/**
 * Get size suffix string for display.
 * B = Byte, W = Word, D = Dword, Q = Qword
 */
export function getSizeSuffix(size: number): string {
  const byteCount = getSizeInBytes(size);
  if (byteCount === 1) return 'B';
  if (byteCount === 2) return 'W';
  if (byteCount === 4) return 'D';
  if (byteCount === 8) return 'Q';
  return `${byteCount}B`;
}

/**
 * Mask a bigint value to the specified byte size.
 */
export function maskToSize(value: bigint, size: number): bigint {
  const byteCount = getSizeInBytes(size);
  const mask = (BigInt(1) << BigInt(byteCount * 8)) - BigInt(1);
  return value & mask;
}

/**
 * Convert number to bigint safely.
 */
export function toBigInt(value: number | bigint): bigint {
  return typeof value === 'number' ? BigInt(value) : value;
}