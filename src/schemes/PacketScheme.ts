/**
 * Packet types for bus communication.
 */

// ============== Basic Request/Response ==============

export interface ReadRequest {
  type: "read";
  addr: number;
  size: number;
}

export interface ReadResponse {
  type: "read";
  addr: number;
  size: number;
  value: bigint;
}

export interface WriteRequest {
  type: "write";
  addr: number;
  size: number;
  value: bigint;
  writeMask?: number; // Bytewise mask, e.g., 0b1111 for 4-byte write
}

export interface WriteResponse {
  type: "write";
  addr: number;
  size: number;
  value: bigint;
}

// ============== Cache Management Requests ==============

/**
 * Invalidate cache line(s) - discard without writeback.
 */
export interface InvalidateRequest {
  type: "inval";
  addr?: number; // If undefined, invalidate all
  global: boolean;
}

export interface InvalidateResponse {
  type: "inval";
  success: boolean;
}

/**
 * Clean cache line(s) - writeback dirty data, keep valid.
 */
export interface CleanRequest {
  type: "clean";
  addr?: number;
  global: boolean;
}

export interface CleanResponse {
  type: "clean";
  success: boolean;
}

/**
 * Flush cache line(s) - writeback dirty data and invalidate.
 */
export interface FlushRequest {
  type: "flush";
  addr?: number;
  global: boolean;
}

export interface FlushResponse {
  type: "flush";
  success: boolean;
}

/**
 * Zero cache line - allocate and zero without fetch.
 */
export interface ZeroRequest {
  type: "zero";
  addr: number;
}

export interface ZeroResponse {
  type: "zero";
  addr: number;
  success: boolean;
}

/**
 * Prefetch cache line - fetch into cache without returning data.
 */
export interface PrefetchRequest {
  type: "prefetch";
  addr: number;
}

export interface PrefetchResponse {
  type: "prefetch";
  addr: number;
  success: boolean;
}

/**
 * Cache line write with mask - write entire line with bytewise mask.
 */
export interface LineWriteRequest {
  type: "line_write";
  addr: number;
  lineSize: number;
  data: bigint;
  writeMask: number; // Bytewise mask
}

export interface LineWriteResponse {
  type: "line_write";
  addr: number;
  success: boolean;
}

/**
 * Cache line read request - fetch entire line.
 */
export interface LineReadRequest {
  type: "line_read";
  addr: number;
  lineSize: number;
}

export interface LineReadResponse {
  type: "line_read";
  addr: number;
  lineSize: number;
  data: bigint;
}

// ============== Union Types ==============

export type MemRequestPacket =
  | ReadRequest
  | WriteRequest
  | LineReadRequest
  | LineWriteRequest;

export type RequestPacket =
  | ReadRequest
  | WriteRequest
  | InvalidateRequest
  | CleanRequest
  | FlushRequest
  | ZeroRequest
  | PrefetchRequest
  | LineReadRequest
  | LineWriteRequest;

export type ResponsePacket =
  | ReadResponse
  | WriteResponse
  | InvalidateResponse
  | CleanResponse
  | FlushResponse
  | ZeroResponse
  | PrefetchResponse
  | LineReadResponse
  | LineWriteResponse;
