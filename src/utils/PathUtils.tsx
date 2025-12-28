import { Vector2, Random } from '@motion-canvas/core';

/**
 * Generates a straight path from a random position outside the screen to the center (0,0).
 * @param random The Random instance for reproducibility.
 * @param minDist Minimum distance from the center.
 * @param maxDist Maximum distance from the center.
 */
export function generateStraightPathPoints(
  random: Random,
  minDist: number = 1000,
  maxDist: number = 1200
): Vector2[] {
  const angle = random.nextInt(0, 360) * (Math.PI / 180);
  const dist = random.nextInt(minDist, maxDist);

  const start = new Vector2(Math.cos(angle), Math.sin(angle)).scale(dist);
  const end = Vector2.zero;

  return [start, end];
}
