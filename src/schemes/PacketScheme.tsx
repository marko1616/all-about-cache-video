/**
 * Represents a READ request packet.
 * Contains the target address and size for the read operation.
 */
export interface ReadRequest {
  type: 'read';
  addr: number;
  size: number; // 0=1B, 1=2B, 2=4B, 3=8B, ...
}

/**
 * Represents a READ response packet.
 * Contains the address, size, and the data value read from that address.
 */
export interface ReadResponse {
  type: 'read';
  addr: number;
  size: number;
  value: bigint;
}

/**
 * Represents a WRITE request packet.
 * Contains the target address, size, and the data value to be written.
 */
export interface WriteRequest {
  type: 'write';
  addr: number;
  size: number;
  value: bigint;
}

/**
 * Represents a WRITE response packet.
 * Contains the address, size, and confirmation of the written value.
 */
export interface WriteResponse {
  type: 'write';
  addr: number;
  size: number;
  value: bigint;
}

/**
 * Union type for all request packet types.
 */
export type RequestPacket = ReadRequest | WriteRequest;

/**
 * Union type for all response packet types.
 */
export type ResponsePacket = ReadResponse | WriteResponse;