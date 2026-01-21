
import { Bubble, BubbleType, GridCell, GameStatus } from '../types';
import { getNeighbors } from './gridUtils';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants';

export const findMatchCluster = (grid: GridCell[][], startRow: number, startCol: number): { row: number, col: number }[] => {
  const startBubble = grid[startRow][startCol].bubble;
  if (!startBubble || !startBubble.emojiKey) return [];

  const emoji = startBubble.emojiKey;
  const cluster: { row: number, col: number }[] = [];
  const visited = new Set<string>();
  const queue = [{ row: startRow, col: startCol }];

  visited.add(`${startRow},${startCol}`);

  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    const cell = grid[row][col];
    
    if (cell.bubble && (cell.bubble.emojiKey === emoji || cell.bubble.type === BubbleType.WILD)) {
      cluster.push({ row, col });
      
      const neighbors = getNeighbors(row, col, GRID_WIDTH, GRID_HEIGHT);
      for (const n of neighbors) {
        const nKey = `${n.row},${n.col}`;
        if (!visited.has(nKey)) {
          visited.add(nKey);
          queue.push(n);
        }
      }
    }
  }

  return cluster.length >= 3 ? cluster : [];
};

export const getAnchoredBubbles = (grid: GridCell[][]): Set<string> => {
  const anchored = new Set<string>();
  const queue: { row: number, col: number }[] = [];

  // All bubbles in row 0 are anchors
  for (let c = 0; c < GRID_WIDTH; c++) {
    if (grid[0][c].bubble) {
      const key = `0,${c}`;
      anchored.add(key);
      queue.push({ row: 0, col: c });
    }
  }

  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    const neighbors = getNeighbors(row, col, GRID_WIDTH, GRID_HEIGHT);
    
    for (const n of neighbors) {
      const nKey = `${n.row},${n.col}`;
      if (grid[n.row][n.col].bubble && !anchored.has(nKey)) {
        anchored.add(nKey);
        queue.push(n);
      }
    }
  }

  return anchored;
};

export const resolveExplosion = (grid: GridCell[][], row: number, col: number, radius: number = 1): { row: number, col: number }[] => {
  const affected: { row: number, col: number }[] = [];
  const visited = new Set<string>();
  let currentLayer = [{ row, col }];
  visited.add(`${row},${col}`);

  for (let r = 0; r <= radius; r++) {
    const nextLayer: { row: number, col: number }[] = [];
    for (const cell of currentLayer) {
      affected.push(cell);
      const neighbors = getNeighbors(cell.row, cell.col, GRID_WIDTH, GRID_HEIGHT);
      for (const n of neighbors) {
        const nKey = `${n.row},${n.col}`;
        if (!visited.has(nKey)) {
          visited.add(nKey);
          nextLayer.push(n);
        }
      }
    }
    currentLayer = nextLayer;
  }
  return affected;
};
