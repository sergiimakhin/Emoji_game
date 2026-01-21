
import React from 'react';
import { Bubble as BubbleType } from '../types';
import Bubble from './Bubble';
import { BUBBLE_RADIUS } from '../constants';

interface CannonProps {
  angle: number;
  currentBubble: BubbleType;
  nextBubble: BubbleType;
  position: { x: number, y: number };
}

const Cannon: React.FC<CannonProps> = ({ angle, currentBubble, nextBubble, position }) => {
  return (
    <div 
      className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
      style={{ zIndex: 100 }}
    >
      <div className="relative">
        {/* Cannon Base Pivot */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-24 h-24 bg-gradient-to-t from-slate-900 to-slate-700 rounded-full border-4 border-slate-800 shadow-2xl z-0" />
        
        {/* Cannon Barrel */}
        <div 
          className="relative w-16 h-36 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-800 rounded-t-xl rounded-b-lg border-x-2 border-slate-900 shadow-xl origin-bottom transition-transform duration-75"
          style={{ transform: `rotate(${angle}deg)`, marginBottom: '20px' }}
        >
          {/* Barrel Details - Rivets and Metal bands */}
          <div className="absolute top-4 left-0 w-full h-1 bg-black/40" />
          <div className="absolute top-1/2 left-0 w-full h-1 bg-black/40" />
          
          {/* Muzzle Tip Flaring */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-slate-700 rounded-full border-2 border-slate-900" />
          
          {/* Active Bubble on Tip Center - Adjusted for perfect centering on the barrel mouth */}
          <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center justify-center">
            <Bubble 
              bubble={currentBubble} 
              className="scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" 
            />
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-3xl border border-white/10 backdrop-blur-md">
        <span className="text-white/30 text-[10px] font-black uppercase tracking-widest pl-2">Next:</span>
        <div className="scale-75 origin-center">
          <Bubble bubble={nextBubble} />
        </div>
      </div>
    </div>
  );
};

export default Cannon;
