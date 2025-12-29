import { MotionGenerator } from "./UtilScheme";

/**
 * Represents the data packet structure transmitted through the bus.
 *
 * @template PayloadType The type of the content field.
 *
 * Note: The `id` field is reserved for future bus MUX/DEMUX routing.
 */
export interface Payload<PayloadType = unknown> {
  id: string;
  display: string;
  content: PayloadType;
}

/**
 * Defines the behavior of the slave device connected to the bus.
 *
 * The handler receives the request payload, performs internal processing animations,
 * and yields the response payload.
 *
 * Fix details:
 * 1. Uses the standard Generator interface.
 * 2. The Yield type (1st arg) is ThreadGenerator | Promise<any> (excludes number).
 * 3. The Return type (2nd arg) is Payload, ensuring data can be returned to the bus.
 *
 * @template TRequest The type of the request payload content.
 * @template TResponse The type of the response payload content.
 */
export type BusSlaveHandler<TRequest = unknown, TResponse = unknown> = (
  payload: Payload<TRequest>,
) => MotionGenerator<Payload<TResponse>>;
