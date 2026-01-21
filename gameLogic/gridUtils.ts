
import { HEX_WIDTH, HEX_HEIGHT } from '../constants';
import { Point } from '../types';

/**
 * We use a "pointy topped" hex grid with odd-row offsets.
 * Row 0 is the ceiling.
 */
export const getPixelCoords = (row: number, col: number): Point => {
  const xOffset = row % 2 === 0 ? 0 : HEX_WIDTH / 2;
  return {
    x: col * HEX_WIDTH + xOffset + HEX_WIDTH / 2,
    y: row * HEX_HEIGHT * 0.75 + HEX_HEIGHT / 2
  };
};

export const getGridCoords = (x: number, y: number): { row: number, col: number } => {
  // Rough estimate, can be refined with precise hex math if needed
  const row = Math.round((y - HEX_HEIGHT / 2) / (HEX_HEIGHT * 0.75));
  const xOffset = row % 2 === 0 ? 0 : HEX_WIDTH / 2;
  const col = Math.round((x - xOffset - HEX_WIDTH / 2) / HEX_WIDTH);
  return { row, col };
};

export const getNeighbors = (row: number, col: number, width: number, height: number) => {
  const neighbors: { row: number, col: number }[] = [];
  const evenRow = row % 2 === 0;

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
