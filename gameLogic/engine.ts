
import { Bubble, BubbleType, GridCell, GameStatus } from '../types';
import { getNeighbors } from './gridUtils';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants';

/**
 * Finds a cluster of matching bubbles.
 * If start bubble is STANDARD: finds same emojiKey or WILDs.
 * If start bubble is WILD: adopts neighbor emojis to see if it can form a 3+ cluster.
 */
export const findMatchCluster = (grid: GridCell[][], startRow: number, startCol: number): { row: number, col: number }[] => {
  const startBubble = grid[startRow][startCol].bubble;
  if (!startBubble) return [];

  const visitedOverall = new Set<string>();
  const totalResults: { row: number, col: number }[] = [];

  // Helper to find cluster for a target emoji adopting WILDs along the way
  const findClusterForEmoji = (emoji: string) => {
    const cluster: { row: number, col: number }[] = [];
    const visited = new Set<string>();
    const queue = [{ row: startRow, col: startCol }];
    visited.add(`${startRow},${startCol}`);

    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      const cell = grid[row][col];
      
      // A cell matches if it has the same emojiKey or is a WILD
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
    return cluster;
  };

  if (startBubble.type === BubbleType.WILD) {
    // Shot adopts any neighboring emojis to check for clusters
    const neighbors = getNeighbors(startRow, startCol, GRID_WIDTH, GRID_HEIGHT);
    const candidateEmojis = new Set<string>();
    for (const n of neighbors) {
      const b = grid[n.row][n.col].bubble;
      if (b && b.emojiKey) candidateEmojis.add(b.emojiKey);
    }

    for (const emoji of candidateEmojis) {
      const cluster = findClusterForEmoji(emoji);
      if (cluster.length >= 3) {
        cluster.forEach(c => {
          const key = `${c.row},${c.col}`;
          if (!visitedOverall.has(key)) {
            visitedOverall.add(key);
            totalResults.push(c);
          }
        });
      }
    }
  } else if (startBubble.emojiKey) {
    // Standard shot cluster search
    const cluster = findClusterForEmoji(startBubble.emojiKey);
    if (cluster.length >= 3) return cluster;
  }

  return totalResults;
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
