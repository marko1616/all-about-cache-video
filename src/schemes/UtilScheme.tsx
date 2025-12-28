import { ThreadGenerator, Promisable } from "@motion-canvas/core";

/**
 * A specialized Generator type compatible with the Motion Canvas runtime that
 * allows returning a specific value type `T`.
 *
 * This type extends the standard generator behavior to support yielding
 * animation primitives (Threads, Promises, Promisables) while strictly
 * typing the final return value.
 *
 * Use this instead of `ThreadGenerator` when your animation function needs
 * to return data (e.g., a processed payload) to the caller after the
 * animation sequence completes.
 *
 * @template T - The type of the value returned by the generator.
 */
export type MotionGenerator<T> = Generator<
  ThreadGenerator | Promise<any> | Promisable<any> | void,
  T,
  any
>;