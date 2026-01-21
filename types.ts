
export enum BubbleType {
  STANDARD = 'STANDARD',
  WILD = 'WILD',
  BOMB = 'BOMB',
  LINECLEAR = 'LINECLEAR',
  COLORCLEAR = 'COLORCLEAR',
  STONE = 'STONE',
  ICE = 'ICE',
  CHAIN = 'CHAIN',
  CAPTIVE = 'CAPTIVE',
  DROP = 'DROP'
}

export enum GameStatus {
  PLAYING = 'PLAYING',
  WIN = 'WIN',
  LOSE = 'LOSE',
  RESOLVING = 'RESOLVING',
  IDLE = 'IDLE'
}

export enum GameMode {
  CLASSIC = 'CLASSIC',
  PRESSURE = 'PRESSURE'
}

export interface Bubble {
  id: string;
  type: BubbleType;
  emojiKey: string | null;
  hp: number;
  innerBubble?: Bubble;
  isLocked?: boolean;
}

export interface GridCell {
  row: number;
  col: number;
  bubble: Bubble | null;
  overlay?: 'JELLY' | 'MUD';
  jellyLayers?: number;
}

export interface GameState {
  grid: GridCell[][];
  shotLimit: number;
  shotsUsed: number;
  score: number;
  timeLeft: number;
  nextRowIn: number;
  pressureInterval: number; // The current duration for the next row arrival
  mode: GameMode;
  activePalette: string[];
  status: GameStatus;
  objectives: {
    type: string;
    target: number;
    current: number;
  }[];
  currentShot: Bubble;
  nextShot: Bubble;
}

export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}
