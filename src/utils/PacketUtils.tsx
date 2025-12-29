import {
  ReadRequest,
  ReadResponse,
  WriteRequest,
  WriteResponse,
  InvalidateRequest,
  CleanRequest,
  FlushRequest,
  ZeroRequest,
  PrefetchRequest,
  LineReadRequest,
  LineReadResponse,
  LineWriteRequest,
  LineWriteResponse,
  RequestPacket,
  ResponsePacket,
} from "../schemes/PacketScheme";

// ============== Type Guards ==============

export function isReadRequest(p: RequestPacket): p is ReadRequest {
  return p.type === "read";
}

export function isWriteRequest(p: RequestPacket): p is WriteRequest {
  return p.type === "write";
}

export function isReadResponse(p: ResponsePacket): p is ReadResponse {
  return p.type === "read";
}

export function isWriteResponse(p: ResponsePacket): p is WriteResponse {
  return p.type === "write";
}

export function isInvalRequest(p: RequestPacket): p is InvalidateRequest {
  return p.type === "inval";
}

export function isCleanRequest(p: RequestPacket): p is CleanRequest {
  return p.type === "clean";
}

export function isFlushRequest(p: RequestPacket): p is FlushRequest {
  return p.type === "flush";
}

export function isZeroRequest(p: RequestPacket): p is ZeroRequest {
  return p.type === "zero";
}

export function isPrefetchRequest(p: RequestPacket): p is PrefetchRequest {
  return p.type === "prefetch";
}

export function isLineReadRequest(p: RequestPacket): p is LineReadRequest {
  return p.type === "line_read";
}

export function isLineReadResponse(p: ResponsePacket): p is LineReadResponse {
  return p.type === "line_read";
}

export function isLineWriteRequest(p: RequestPacket): p is LineWriteRequest {
  return p.type === "line_write";
}

export function isLineWriteResponse(p: ResponsePacket): p is LineWriteResponse {
  return p.type === "line_write";
}

export function isCacheManagementRequest(p: RequestPacket): boolean {
  return ["inval", "clean", "flush", "zero", "prefetch"].includes(p.type);
}

// ============== Formatting ==============

export function formatAddr(addr: number): string {
  return "0x" + (addr & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

export function formatMultiByteValue(value: bigint, size: number): string {
  const byteCount = getSizeInBytes(size);
  const hexLen = byteCount * 2;
  const mask = (BigInt(1) << BigInt(byteCount * 8)) - BigInt(1);
  return "0x" + (value & mask).toString(16).toUpperCase().padStart(hexLen, "0");
}

export function formatWriteMask(mask: number, lineSize: number): string {
  return "0b" + mask.toString(2).padStart(lineSize, "0");
}

export function getSizeSuffix(size: number): string {
  switch (size) {
    case 0:
      return ".B";
    case 1:
      return ".W";
    case 2:
      return ".D";
    case 3:
      return ".Q";
    default:
      return "";
  }
}

export function getSizeInBytes(size: number): number {
  return 1 << size;
}

export function formatValue(value: number): string {
  return "0x" + (value & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

// ============== Data Manipulation ==============

export function maskToSize(value: bigint, size: number): bigint {
  const byteCount = getSizeInBytes(size);
  const mask = (BigInt(1) << BigInt(byteCount * 8)) - BigInt(1);
  return value & mask;
}

export function toBigInt(value: number | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

export function applyWriteMask(
  oldData: bigint,
  newData: bigint,
  writeMask: number,
  lineSize: number,
): bigint {
  let result = oldData;
  for (let i = 0; i < lineSize; i++) {
    if ((writeMask >> i) & 1) {
      const shift = BigInt(i * 8);
      const byteMask = BigInt(0xff) << shift;
      result = (result & ~byteMask) | (newData & byteMask);
    }
  }
  return result;
}

export function generateFullMask(byteCount: number): number {
  return (1 << byteCount) - 1;
}
