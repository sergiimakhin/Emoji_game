
import { HEX_WIDTH, HEX_HEIGHT, BUBBLE_RADIUS } from '../constants';
import { Point } from '../types';

/**
 * Standard bubble shooter hex grid:
 * Even rows (0, 2, ...): Standard alignment, start at x = HEX_WIDTH / 2.
 * Odd rows (1, 3, ...): Shifted right by HEX_WIDTH / 2, start at x = HEX_WIDTH.
 * This makes even rows touch the left wall and odd rows touch the right wall.
 */

export const getPixelCoords = (row: number, col: number): Point => {
  const isEven = row % 2 === 0;
  const rowOffset = isEven ? 0 : HEX_WIDTH / 2;
  
  return {
    x: col * HEX_WIDTH + rowOffset + HEX_WIDTH / 2,
    y: row * HEX_HEIGHT * 0.75 + BUBBLE_RADIUS
  };
};

export const getGridCoords = (x: number, y: number): { row: number, col: number } => {
  const row = Math.round((y - BUBBLE_RADIUS) / (HEX_HEIGHT * 0.75));
  const isEven = row % 2 === 0;
  const rowOffset = isEven ? 0 : HEX_WIDTH / 2;
  
  const col = Math.round((x - rowOffset - HEX_WIDTH / 2) / HEX_WIDTH);
  return { row, col };
};

export const getNeighbors = (row: number, col: number, width: number, height: number) => {
  const neighbors: { row: number, col: number }[] = [];
  const evenRow = row % 2 === 0;

  // Neighbors depend on whether the row is even or odd due to the horizontal offset
  const potential = evenRow
    ? [
        { r: row - 1, c: col - 1 }, { r: row - 1, c: col },
        { r: row, c: col - 1 },     { r: row, c: col + 1 },
        { r: row + 1, c: col - 1 }, { r: row + 1, c: col }
      ]
    : [
        { r: row - 1, c: col },     { r: row - 1, c: col + 1 },
        { r: row, c: col - 1 },     { r: row, c: col + 1 },
        { r: row + 1, c: col },     { r: row + 1, c: col + 1 }
      ];

  for (const { r, c } of potential) {
    if (r >= 0 && r < height && c >= 0 && c < width) {
      neighbors.push({ row: r, col: c });
    }
  }
  return neighbors;
};
