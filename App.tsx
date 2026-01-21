
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BubbleType, 
  GameStatus, 
  GameState, 
  GameMode,
  Bubble as BubbleInterface, 
  Point, 
  Vector 
} from './types';
import { 
  GRID_WIDTH, 
  GRID_HEIGHT, 
  BUBBLE_RADIUS, 
  HEX_WIDTH, 
  HEX_HEIGHT, 
  FAIL_LINE_ROW, 
  EMOJI_PALETTES,
  SPECIAL_EMOJIS
} from './constants';
import { getPixelCoords, getGridCoords, getNeighbors } from './gameLogic/gridUtils';
import { findMatchCluster, getAnchoredBubbles, resolveExplosion } from './gameLogic/engine';
import { getLevelHint, LevelHint } from './services/geminiService';
import Bubble from './components/Bubble';
import Cannon from './components/Cannon';

interface ExplosionEffect {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface ScoreRecord {
  score: number;
  date: number;
  mode: GameMode;
}

const INITIAL_PRESSURE_INTERVAL = 60;
const MIN_PRESSURE_INTERVAL = 15;
const PRESSURE_DECREMENT = 2;

// Standardized game dimensions
// Perfectly fits the hex grid widest row
const GAME_CONTENT_WIDTH = (GRID_WIDTH + 0.5) * HEX_WIDTH;
// Calculate top-row y-offset and fail line correctly
const FAIL_LINE_Y = (FAIL_LINE_ROW * HEX_HEIGHT * 0.75) + BUBBLE_RADIUS;
// Position the pivot just below the fail line
const CANNON_PIVOT_Y = FAIL_LINE_Y + 48;
const CANNON_PIVOT_X = GAME_CONTENT_WIDTH / 2;
// Ensure board container is tall enough to show cannon and preview
const GAME_CONTENT_HEIGHT = CANNON_PIVOT_Y + 120;
const CANNON_BARREL_LENGTH = 100;

const App: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<GameMode>(GameMode.CLASSIC);
  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [cannonAngle, setCannonAngle] = useState(0);
  const [hint, setHint] = useState<LevelHint | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [flyingBubble, setFlyingBubble] = useState<{ pos: Point, velocity: Vector, bubble: BubbleInterface } | null>(null);
  const [lastPlacedCell, setLastPlacedCell] = useState<{row: number, col: number} | null>(null);
  const [blasts, setBlasts] = useState<ExplosionEffect[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  const [isGridShifting, setIsGridShifting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  
  const boardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('emoji_blast_leaderboard');
    if (saved) {
      setLeaderboard(JSON.parse(saved));
    }
  }, []);

  const saveScore = useCallback((finalScore: number) => {
    if (finalScore <= 0) return;
    const currentMode = stateRef.current?.mode || selectedMode;
    const newRecord: ScoreRecord = { score: finalScore, date: Date.now(), mode: currentMode };
    const updated = [...leaderboard, newRecord]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    setLeaderboard(updated);
    localStorage.setItem('emoji_blast_leaderboard', JSON.stringify(updated));
  }, [leaderboard, selectedMode]);

  const generateRandomBubble = useCallback((palette: string[]): BubbleInterface => {
    const isSpecial = Math.random() < 0.12; 
    if (isSpecial) {
      const types = [BubbleType.BOMB, BubbleType.LINECLEAR, BubbleType.WILD];
      return {
        id: Math.random().toString(36).substr(2, 9),
        type: types[Math.floor(Math.random() * types.length)] || BubbleType.STANDARD,
        emojiKey: null,
        hp: 1
      };
    }
    return {
      id: Math.random().toString(36).substr(2, 9),
      type: BubbleType.STANDARD,
      emojiKey: palette[Math.floor(Math.random() * palette.length)] || null,
      hp: 1
    };
  }, []);

  const shiftGridDown = useCallback(async () => {
    if (!stateRef.current || isGridShifting) return;

    setIsGridShifting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    setState(prevState => {
      if (!prevState) return null;

      const newGrid = Array.from({ length: GRID_HEIGHT }, (_, r) => 
        Array.from({ length: GRID_WIDTH }, (_, c) => ({ row: r, col: c, bubble: null as BubbleInterface | null }))
      );

      let overflow = false;
      for (let r = 0; r < GRID_HEIGHT - 1; r++) {
        for (let c = 0; c < GRID_WIDTH; c++) {
          const bubble = prevState.grid[r] && prevState.grid[r][c] ? prevState.grid[r][c].bubble : null;
          if (bubble) {
            newGrid[r + 1][c].bubble = bubble;
            if (r + 1 >= FAIL_LINE_ROW) overflow = true;
          }
        }
      }

      for (let c = 0; c < GRID_WIDTH; c++) {
        newGrid[0][c].bubble = generateRandomBubble(prevState.activePalette);
      }

      const nextInterval = Math.max(MIN_PRESSURE_INTERVAL, prevState.pressureInterval - PRESSURE_DECREMENT);

      return {
        ...prevState,
        grid: newGrid,
        status: overflow ? GameStatus.LOSE : prevState.status,
        pressureInterval: nextInterval,
        nextRowIn: nextInterval
      };
    });

    setIsGridShifting(false);
  }, [generateRandomBubble, isGridShifting]);

  const initLevel = useCallback(() => {
    const palette = EMOJI_PALETTES[Math.floor(Math.random() * EMOJI_PALETTES.length)];
    const newGrid = Array.from({ length: GRID_HEIGHT }, (_, r) => 
      Array.from({ length: GRID_WIDTH }, (_, c) => {
        const seedSpecial = r < 5 && Math.random() < 0.05;
        let bubble: BubbleInterface | null = null;
        if (seedSpecial) {
           const types = [BubbleType.BOMB, BubbleType.LINECLEAR, BubbleType.STONE];
           bubble = {
              id: Math.random().toString(36).substr(2, 9),
              type: types[Math.floor(Math.random() * types.length)] || BubbleType.STANDARD,
              emojiKey: null,
              hp: 1
           };
        } else if (r < 5) {
           bubble = generateRandomBubble(palette);
           if (bubble && bubble.type !== BubbleType.STANDARD) bubble.type = BubbleType.STANDARD;
           if (bubble) bubble.emojiKey = palette[Math.floor(Math.random() * palette.length)] || null;
        }
        return { row: r, col: c, bubble };
      })
    );

    setState({
      grid: newGrid,
      shotLimit: selectedMode === GameMode.PRESSURE ? 999999 : 40,
      shotsUsed: 0,
      score: 0,
      timeLeft: selectedMode === GameMode.CLASSIC ? 180 : 99999,
      pressureInterval: INITIAL_PRESSURE_INTERVAL,
      nextRowIn: INITIAL_PRESSURE_INTERVAL,
      mode: selectedMode,
      activePalette: palette,
      currentShot: generateRandomBubble(palette),
      nextShot: generateRandomBubble(palette),
      status: GameStatus.PLAYING,
      objectives: [{ type: 'Clear Board', target: 0, current: 0 }]
    });

    getLevelHint(1, selectedMode === GameMode.CLASSIC ? "Clear the board before time runs out!" : "Keep the board clear! A new row arrives every minute.").then(setHint);
  }, [generateRandomBubble, selectedMode]);

  useEffect(() => {
    if (state?.status === GameStatus.PLAYING) {
      timerRef.current = window.setInterval(async () => {
        const current = stateRef.current;
        if (!current || current.status !== GameStatus.PLAYING) return;

        if (current.mode === GameMode.CLASSIC) {
          setState(prev => {
            if (!prev) return null;
            if (prev.timeLeft <= 1) return { ...prev, timeLeft: 0, status: GameStatus.LOSE };
            return { ...prev, timeLeft: prev.timeLeft - 1 };
          });
        } 
        
        if (current.mode === GameMode.PRESSURE) {
          if (current.nextRowIn <= 1) {
            await shiftGridDown();
          } else {
            setState(prev => prev ? ({ ...prev, nextRowIn: prev.nextRowIn - 1 }) : null);
          }
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      if (state && (state.status === GameStatus.LOSE || state.status === GameStatus.WIN)) {
        saveScore(state.score);
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state?.status, state?.mode, shiftGridDown, saveScore]);

  useEffect(() => {
    initLevel();
  }, [initLevel]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!boardRef.current || state?.status !== GameStatus.PLAYING || showRules) return;
    const rect = boardRef.current.getBoundingClientRect();
    
    // Mouse coords relative to board container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const dx = mouseX - CANNON_PIVOT_X;
    const dy = CANNON_PIVOT_Y - mouseY;
    const angle = Math.atan2(dx, dy) * (180 / Math.PI);
    
    setCannonAngle(Math.max(-85, Math.min(85, angle)));
  };

  const fireShot = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.sidebar-ui') || (e.target as HTMLElement).closest('.modal-ui') || showRules) return;
    if (!state || state.status !== GameStatus.PLAYING || flyingBubble || isGridShifting) return;

    const radians = (cannonAngle - 90) * (Math.PI / 180);
    const speed = 12.15; 
    const velocity = { x: Math.cos(radians) * speed, y: Math.sin(radians) * speed };
    
    // Start shot from the muzzle tip instead of pivot for better visual flow
    const startX = CANNON_PIVOT_X + Math.cos(radians) * CANNON_BARREL_LENGTH;
    const startY = CANNON_PIVOT_Y + Math.sin(radians) * CANNON_BARREL_LENGTH;

    setFlyingBubble({
      pos: { x: startX, y: startY },
      velocity,
      bubble: state.currentShot
    });

    setState(prev => prev ? ({ ...prev, shotsUsed: prev.shotsUsed + 1 }) : null);
  };

  const triggerBlast = (x: number, y: number, color: string = 'white') => {
    const id = Date.now() + Math.random();
    setBlasts(prev => [...prev, { id, x, y, color }]);
    setTimeout(() => {
      setBlasts(prev => prev.filter(b => b.id !== id));
    }, 500);
  };

  const resolveTurn = useCallback(async (hitRow: number, hitCol: number, shotBubble: BubbleInterface) => {
    setState(prev => {
      if (!prev || !shotBubble) return prev;
      let newGrid = [...prev.grid.map(row => [...row])];
      if (hitRow < 0 || hitRow >= GRID_HEIGHT || hitCol < 0 || hitCol >= GRID_WIDTH) return prev;
      
      newGrid[hitRow][hitCol].bubble = shotBubble;
      setLastPlacedCell({row: hitRow, col: hitCol});

      let totalScore = prev.score;
      const cellsToPop: Set<string> = new Set();
      let specialTriggered = false;

      const processEffect = (row: number, col: number, bubble: BubbleInterface) => {
        if (!bubble || !bubble.type) return;

        if (bubble.type === BubbleType.BOMB) {
          specialTriggered = true;
          const affected = resolveExplosion(newGrid, row, col, 1);
          affected.forEach(c => cellsToPop.add(`${c.row},${c.col}`));
          const p = getPixelCoords(row, col);
          triggerBlast(p.x, p.y, '#f59e0b');
        } else if (bubble.type === BubbleType.LINECLEAR) {
          specialTriggered = true;
          for(let c=0; c<GRID_WIDTH; c++) cellsToPop.add(`${row},${c}`);
          const p = getPixelCoords(row, col);
          triggerBlast(p.x, p.y, '#3b82f6');
        } else if (bubble.type === BubbleType.STANDARD || bubble.type === BubbleType.WILD) {
          const cluster = findMatchCluster(newGrid, row, col);
          cluster.forEach(c => cellsToPop.add(`${c.row},${c.col}`));
          if (cluster.length >= 3) {
            const p = getPixelCoords(row, col);
            triggerBlast(p.x, p.y, 'white');
          }
        }
      };

      processEffect(hitRow, hitCol, shotBubble);

      const neighbors = getNeighbors(hitRow, hitCol, GRID_WIDTH, GRID_HEIGHT);
      for (const n of neighbors) {
        const neighborBubble = newGrid[n.row] && newGrid[n.row][n.col] ? newGrid[n.row][n.col].bubble : null;
        if (neighborBubble && (neighborBubble.type === BubbleType.BOMB || neighborBubble.type === BubbleType.LINECLEAR)) {
          processEffect(n.row, n.col, neighborBubble);
        }
      }

      if (cellsToPop.size > 5 || specialTriggered) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 200);
      }

      cellsToPop.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        if (newGrid[r]?.[c]) {
          newGrid[r][c].bubble = null;
          totalScore += 20;
        }
      });

      const anchored = getAnchoredBubbles(newGrid);
      for (let r = 0; r < GRID_HEIGHT; r++) {
        for (let c = 0; c < GRID_WIDTH; c++) {
          if (newGrid[r] && newGrid[r][c] && newGrid[r][c].bubble && !anchored.has(`${r},${c}`)) {
            newGrid[r][c].bubble = null;
            totalScore += 30;
          }
        }
      }

      let hasBubbles = false;
      let reachedFailLine = false;
      for (let r = 0; r < GRID_HEIGHT; r++) {
        for (let c = 0; c < GRID_WIDTH; c++) {
          if (newGrid[r] && newGrid[r][c] && newGrid[r][c].bubble) {
            hasBubbles = true;
            if (r >= FAIL_LINE_ROW) reachedFailLine = true;
          }
        }
      }

      // Shot limit only applies to Classic mode
      const isOutOfShots = prev.mode === GameMode.CLASSIC && prev.shotsUsed >= prev.shotLimit;

      const nextStatus = !hasBubbles ? GameStatus.WIN : 
                         (reachedFailLine || isOutOfShots) ? GameStatus.LOSE : 
                         GameStatus.PLAYING;

      return {
        ...prev,
        grid: newGrid,
        score: totalScore,
        currentShot: prev.nextShot,
        nextShot: generateRandomBubble(prev.activePalette),
        status: nextStatus
      };
    });
  }, [generateRandomBubble]);

  const animate = useCallback(() => {
    setFlyingBubble(prev => {
      if (!prev || !state || !prev.bubble) return null;
      let { x, y } = prev.pos;
      let { x: vx, y: vy } = prev.velocity;

      const steps = 3; 
      for (let i = 0; i < steps; i++) {
        x += vx / steps;
        y += vy / steps;

        // Perfectly aligned wall collision - coincides with the visual container edges
        if (x < BUBBLE_RADIUS) {
          x = BUBBLE_RADIUS;
          vx *= -1;
        } else if (x > GAME_CONTENT_WIDTH - BUBBLE_RADIUS) {
          x = GAME_CONTENT_WIDTH - BUBBLE_RADIUS;
          vx *= -1;
        }

        const { row, col } = getGridCoords(x, y);
        let collided = false;
        let targetRow = row;
        let targetCol = col;

        // Ceiling collision - perfectly aligned with top border
        if (y <= BUBBLE_RADIUS) {
          collided = true;
          targetRow = 0;
          targetCol = Math.max(0, Math.min(GRID_WIDTH - 1, col));
        } else {
          const neighbors = getNeighbors(row, col, GRID_WIDTH, GRID_HEIGHT);
          const candidates = [...neighbors];
          if (row >= 0 && row < GRID_HEIGHT && col >= 0 && col < GRID_WIDTH) candidates.push({ row, col });

          for (const n of candidates) {
            const neighborCell = state.grid[n.row] ? state.grid[n.row][n.col] : null;
            if (neighborCell && neighborCell.bubble) {
              const p = getPixelCoords(n.row, n.col);
              const distSq = (x - p.x) ** 2 + (y - p.y) ** 2;
              if (distSq < (BUBBLE_RADIUS * 1.7) ** 2) {
                collided = true;
                const empties = getNeighbors(n.row, n.col, GRID_WIDTH, GRID_HEIGHT)
                  .filter(e => state.grid[e.row] && !state.grid[e.row][e.col].bubble);
                
                if (empties.length > 0) {
                  const nearest = empties.reduce((a, b) => {
                    const pa = getPixelCoords(a.row, a.col);
                    const pb = getPixelCoords(b.row, b.col);
                    const da = (x - pa.x) ** 2 + (y - pa.y) ** 2;
                    const db = (x - pb.x) ** 2 + (y - pb.y) ** 2;
                    return da < db ? a : b;
                  });
                  targetRow = nearest.row;
                  targetCol = nearest.col;
                } else {
                  targetRow = Math.max(0, Math.min(GRID_HEIGHT - 1, row));
                  targetCol = Math.max(0, Math.min(GRID_WIDTH - 1, col));
                }
                break;
              }
            }
          }
        }

        if (collided) {
          resolveTurn(targetRow, targetCol, prev.bubble);
          return null;
        }
      }

      return { pos: { x, y }, velocity: { x: vx, y: vy }, bubble: prev.bubble };
    });
    requestRef.current = requestAnimationFrame(animate);
  }, [state, resolveTurn]);

  useEffect(() => {
    if (flyingBubble) {
      requestRef.current = requestAnimationFrame(animate);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [flyingBubble, animate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRank = (score: number) => {
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex(s => score > s.score);
    return rank === -1 ? sorted.length + 1 : rank + 1;
  };

  const isPB = state && leaderboard.length > 0 && state.score > leaderboard[0].score;

  if (!state) return <div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-white">Loading Game...</div>;

  return (
    <div 
      className="h-screen w-screen bg-slate-950 flex flex-row items-center justify-center overflow-hidden p-4 no-select"
      onMouseMove={handleMouseMove}
      onClick={fireShot}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-purple-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-blue-600 rounded-full blur-[120px]" />
      </div>

      <div className="hidden lg:flex flex-col gap-4 w-64 mr-8 z-50">
        <div className="sidebar-ui glass-morphism p-5 rounded-[2rem] border border-white/10 shadow-xl">
          <h4 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4 text-center">Game Mode</h4>
          <div className="flex bg-slate-900/50 rounded-2xl p-1 gap-1">
            <button 
              onClick={() => setSelectedMode(GameMode.CLASSIC)}
              className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedMode === GameMode.CLASSIC ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Classic
            </button>
            <button 
              onClick={() => setSelectedMode(GameMode.PRESSURE)}
              className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedMode === GameMode.PRESSURE ? 'bg-red-500 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Pressure
            </button>
          </div>
        </div>

        <div 
          onClick={() => setShowHint(!showHint)}
          className={`sidebar-ui glass-morphism p-5 rounded-[2rem] border border-white/10 transition-all duration-300 cursor-pointer hover:bg-white/10 ${showHint ? 'bg-indigo-600/30 ring-2 ring-indigo-500/50' : ''}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
              <i className="fas fa-magic text-white text-lg"></i>
            </div>
            <h3 className="game-font text-white text-lg tracking-wide">Genie's Tip</h3>
          </div>
          {showHint && (
             <div className="animate-appear">
                <p className="text-white/80 text-sm leading-relaxed mb-3">
                  {hint?.strategy || "Don't let the bubbles stack past the red dashed Fail Line!"}
                </p>
                <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30">
                  <p className="text-indigo-200 text-xs italic font-semibold">"{hint?.motivationalMessage || "Keep blasting!"}"</p>
                </div>
             </div>
          )}
          {!showHint && <p className="text-white/40 text-[10px] font-bold uppercase text-center">Click for advice</p>}
        </div>

        <button 
          onClick={initLevel}
          className="sidebar-ui glass-morphism p-5 rounded-[2rem] border border-white/10 transition-all duration-300 cursor-pointer hover:bg-red-500/20 flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
            <i className="fas fa-redo text-white"></i>
          </div>
          <span className="game-font text-white text-lg tracking-wide uppercase">Restart</span>
        </button>
      </div>

      <div className="flex flex-col items-center">
        <div className="z-10 w-full flex justify-between items-center px-4 py-4 mb-4">
          <div className="flex flex-col">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 game-font drop-shadow-sm">
              EMOJI BLAST
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">
                {state.mode === GameMode.CLASSIC ? 'Classic Mode' : 'Pressure Mode'}
              </span>
              {isPB && (
                <span className="bg-yellow-500/20 border border-yellow-500/40 px-2 py-0.5 rounded text-[8px] text-yellow-400 font-black uppercase animate-pulse">Personal Best!</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowRules(true)}
              className="sidebar-ui glass-morphism px-6 py-3 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/30 transition-all flex items-center gap-2 group ring-4 ring-amber-500/10"
            >
              <i className="fas fa-question-circle text-amber-400 text-xl"></i>
              <span className="game-font text-amber-400 text-sm uppercase tracking-widest">Help</span>
            </button>

            <div className="glass-morphism px-6 py-2 rounded-2xl flex flex-col items-center min-w-[120px]">
              <span className="text-white/40 text-[10px] font-bold uppercase">
                {state.mode === GameMode.CLASSIC ? 'Time' : 'Next Row In'}
              </span>
              <span className={`text-2xl font-black game-font ${
                (state.mode === GameMode.CLASSIC && state.timeLeft < 30) || (state.mode === GameMode.PRESSURE && state.nextRowIn < 10) 
                ? 'text-red-400 animate-pulse' 
                : 'text-white'
              }`}>
                {state.mode === GameMode.CLASSIC ? formatTime(state.timeLeft) : `0:${state.nextRowIn.toString().padStart(2, '0')}`}
              </span>
            </div>
            <div className="glass-morphism px-6 py-2 rounded-2xl flex flex-col items-center min-w-[100px]">
              <span className="text-white/40 text-[10px] font-bold uppercase">Score</span>
              <span className="text-2xl font-black text-white game-font">{state.score.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div 
          ref={boardRef}
          className={`relative glass-morphism rounded-[3rem] border border-white/20 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden cursor-crosshair ${isShaking ? 'shake' : ''}`}
          style={{ 
            width: GAME_CONTENT_WIDTH, 
            height: GAME_CONTENT_HEIGHT,
            boxSizing: 'content-box'
          }}
        >
          {/* Internal Content Container - all calculations relative to 0,0 here */}
          <div className={`relative w-full h-full`}>
            {blasts.map(b => (
              <div 
                key={b.id} 
                className="blast-effect" 
                style={{ 
                  left: b.x - BUBBLE_RADIUS, 
                  top: b.y - BUBBLE_RADIUS, 
                  width: BUBBLE_RADIUS * 2, 
                  height: BUBBLE_RADIUS * 2,
                  borderColor: b.color 
                }} 
              />
            ))}

            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundSize: '40px 40px', backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)' }} />

            <div className="absolute left-0 w-full border-t-2 border-dashed border-red-500/30 z-0" style={{ top: FAIL_LINE_Y }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-500/10 px-4 py-0.5 rounded-full border border-red-500/20">
                <span className="text-red-500/50 text-[10px] font-black uppercase tracking-widest">Fail Line</span>
              </div>
            </div>

            <div className={`relative w-full h-full transition-transform duration-500 ease-in-out ${isGridShifting ? 'translate-y-[52px]' : ''}`}>
              {state.grid.map((row, r) => row.map((cell, c) => {
                if (!cell || !cell.bubble) return null;
                const coords = getPixelCoords(r, c);
                const isLatest = lastPlacedCell?.row === r && lastPlacedCell?.col === c;
                return (
                  <Bubble 
                    key={cell.bubble.id || `${r}-${c}`} 
                    bubble={cell.bubble} 
                    isNew={isLatest}
                    style={{ left: coords.x - BUBBLE_RADIUS, top: coords.y - BUBBLE_RADIUS }}
                  />
                );
              }))}

              {flyingBubble && flyingBubble.bubble && (
                <Bubble 
                  bubble={flyingBubble.bubble}
                  isNew={false}
                  style={{
                    left: flyingBubble.pos.x - BUBBLE_RADIUS,
                    top: flyingBubble.pos.y - BUBBLE_RADIUS,
                    zIndex: 100,
                    transition: 'none'
                  }}
                />
              )}
            </div>

            <Cannon 
              angle={cannonAngle} 
              currentBubble={state.currentShot} 
              nextBubble={state.nextShot} 
              position={{ x: CANNON_PIVOT_X, y: CANNON_PIVOT_Y }}
            />
          </div>
        </div>
      </div>

      <div className="hidden xl:flex flex-col gap-4 w-64 ml-8 z-50">
        <div className="glass-morphism p-6 rounded-[2rem] border border-white/10 flex flex-col items-center">
          <h4 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Shots Used</h4>
          <span className={`text-4xl font-black game-font ${state.mode === GameMode.CLASSIC && state.shotLimit - state.shotsUsed < 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {state.shotsUsed}
          </span>
          {state.mode === GameMode.CLASSIC && (
            <span className="text-white/20 text-[10px] mt-1 font-bold">MAX: {state.shotLimit}</span>
          )}
        </div>

        <div className="glass-morphism p-6 rounded-[2rem] border border-white/10 flex flex-col overflow-hidden h-64">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Personal Bests</h4>
            <i className="fas fa-trophy text-yellow-500 text-xs"></i>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
            {leaderboard.length === 0 ? (
              <div className="text-white/20 text-xs italic text-center py-4">No records yet!</div>
            ) : (
              leaderboard.map((rec, idx) => (
                <div key={idx} className={`flex items-center justify-between p-2 rounded-xl border ${idx === 0 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-white/5 border-white/5'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black ${idx === 0 ? 'text-yellow-400' : 'text-white/40'}`}>#{idx + 1}</span>
                    <span className="text-white text-[10px] font-bold">{rec.score.toLocaleString()}</span>
                  </div>
                  <span className="text-white/20 text-[8px] uppercase">{rec.mode === GameMode.CLASSIC ? 'Clas' : 'Pres'}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex flex-col items-center">
            <span className="text-white/30 text-[10px] font-bold uppercase">Current Rank</span>
            <span className="text-xl text-white font-black game-font">#{getRank(state.score)}</span>
          </div>
        </div>

        <div className="glass-morphism p-6 rounded-[2rem] border border-white/10">
          <h4 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Mood Palette</h4>
          <div className="grid grid-cols-2 gap-2">
            {state.activePalette.map((e, idx) => (
              <div key={idx} className="w-10 h-10 glass-morphism rounded-xl flex items-center justify-center text-xl shadow-inner">
                {e}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showRules && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl animate-appear p-6 overflow-y-auto">
          <div className="modal-ui glass-morphism max-w-3xl w-full rounded-[4rem] border border-white/20 p-10 lg:p-14 relative shadow-2xl no-select">
            <button onClick={() => setShowRules(false)} className="absolute top-10 right-10 text-white/40 hover:text-white transition-colors">
              <i className="fas fa-times text-4xl"></i>
            </button>
            <div className="text-center mb-10">
              <h2 className="text-6xl font-black text-white game-font uppercase tracking-tighter mb-2">Blast Guide</h2>
              <p className="text-amber-400 font-bold uppercase tracking-[0.4em] text-xs">Winning, Losing & Timing</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-black text-red-400 uppercase game-font mb-4 flex items-center gap-3">Modes & Failure</h3>
                  <ul className="space-y-3 text-white/80 text-sm leading-relaxed">
                    <li>• <b className="text-amber-400">Classic Mode:</b> Clear the board before the 3-minute timer hits zero or shots run out!</li>
                    <li>• <b className="text-red-400">Pressure Mode:</b> Every shift, the time between rows <i className="text-red-300">decreases</i>! Speed is key. Infinite shots!</li>
                    <li>• <b className="text-red-300">Fail Line:</b> If bubbles cross the red dashed line at the bottom, it's Game Over!</li>
                    <li>• <b className="text-red-300">Shot Limit:</b> Classic mode gives you 40 shots. Aim carefully!</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-green-400 uppercase game-font mb-4 flex items-center gap-3">How to Win</h3>
                  <ul className="space-y-3 text-white/80 text-sm leading-relaxed">
                    <li>• <b>Total Clear:</b> Remove every standard bubble from the board. Blockers (Stones) don't count towards the win.</li>
                  </ul>
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-2xl font-black text-amber-400 uppercase game-font mb-4 flex items-center gap-3">Special Powers</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-5 glass-morphism p-5 rounded-[2rem] border border-amber-500/20">
                    <span className="text-5xl drop-shadow-xl animate-pulse">{SPECIAL_EMOJIS.BOMB}</span>
                    <div><h4 className="font-black text-amber-300 text-sm uppercase">Mega Bomb</h4><p className="text-[12px] text-white/60">Destroys everything in a 1-hex radius.</p></div>
                  </div>
                  <div className="flex items-center gap-5 glass-morphism p-5 rounded-[2rem] border border-blue-500/20">
                    <span className="text-5xl drop-shadow-xl">{SPECIAL_EMOJIS.LINECLEAR}</span>
                    <div><h4 className="font-black text-blue-300 text-sm uppercase">Line Clear</h4><p className="text-[12px] text-white/60">Wipes the entire horizontal row instantly.</p></div>
                  </div>
                  <div className="flex items-center gap-5 glass-morphism p-5 rounded-[2rem] border-purple-500/20">
                    <span className="text-5xl drop-shadow-xl">{SPECIAL_EMOJIS.WILD}</span>
                    <div><h4 className="font-black text-purple-300 text-sm uppercase">Rainbow Wild</h4><p className="text-[12px] text-white/60">Matches any emoji mood instantly.</p></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center mt-12">
              <button onClick={() => setShowRules(false)} className="px-16 py-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black rounded-full shadow-xl transition-all transform hover:scale-110 uppercase tracking-widest text-xl game-font">Let's Blast!</button>
            </div>
          </div>
        </div>
      )}

      {state.status !== GameStatus.PLAYING && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-appear">
          <div className="glass-morphism p-12 rounded-[4rem] shadow-2xl flex flex-col items-center max-w-sm w-full border border-white/20 relative">
            {isPB && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 font-black px-8 py-3 rounded-full shadow-2xl animate-bounce game-font uppercase tracking-tighter border-4 border-white/40">
                New Record!
              </div>
            )}
            <div className={`text-8xl mb-8 ${state.status === GameStatus.WIN ? 'text-yellow-400' : 'text-red-500'}`}>
              <i className={`fas ${state.status === GameStatus.WIN ? 'fa-crown animate-bounce' : 'fa-skull-crossbones'}`}></i>
            </div>
            <h2 className="text-4xl font-black text-white mb-2 game-font uppercase tracking-tighter">
              {state.status === GameStatus.WIN ? 'Winner!' : 'Game Over'}
            </h2>
            <div className="text-white/60 text-sm mb-8 text-center px-4">
              {state.status === GameStatus.WIN ? 'Masterfully cleared!' : (
                state.timeLeft === 0 && state.mode === GameMode.CLASSIC ? 'Time\'s up! Better luck next time.' :
                state.shotsUsed >= state.shotLimit && state.mode === GameMode.CLASSIC ? 'Out of moves! Aim better.' :
                'The board overflowed! Pressure was too much.'
              )}
            </div>
            <div className="w-full bg-white/5 rounded-3xl p-6 mb-10 border border-white/10 text-center">
              <span className="text-white/30 text-xs font-bold uppercase tracking-widest">Final Score</span>
              <div className="text-3xl font-black text-white game-font">{state.score.toLocaleString()}</div>
              <div className="text-[10px] text-white/20 font-bold uppercase mt-1">Global Rank: #{getRank(state.score)}</div>
            </div>
            <button onClick={initLevel} className="w-full py-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black rounded-full shadow-lg transition-all transform hover:scale-105 uppercase tracking-widest game-font">
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
