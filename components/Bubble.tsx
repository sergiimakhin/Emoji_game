
import React from 'react';
import { Bubble as BubbleInterface, BubbleType as BT } from '../types';
import { BUBBLE_RADIUS, SPECIAL_EMOJIS } from '../constants';

interface BubbleProps {
  bubble: BubbleInterface;
  style?: React.CSSProperties;
  className?: string;
  isNew?: boolean;
}

const Bubble: React.FC<BubbleProps> = ({ bubble, style, className, isNew }) => {
  // Guard against null/undefined bubble object
  if (!bubble) return null;

  const getDisplayEmoji = () => {
    // Defensive check for type
    const type = bubble.type;
    if (!type) return "?";

    switch (type) {
      case BT.STANDARD: return bubble.emojiKey || "?";
      case BT.BOMB: return SPECIAL_EMOJIS.BOMB;
      case BT.LINECLEAR: return SPECIAL_EMOJIS.LINECLEAR;
      case BT.COLORCLEAR: return SPECIAL_EMOJIS.COLORCLEAR;
      case BT.WILD: return SPECIAL_EMOJIS.WILD;
      case BT.STONE: return SPECIAL_EMOJIS.STONE;
      case BT.ICE: return SPECIAL_EMOJIS.ICE;
      case BT.CAPTIVE: return SPECIAL_EMOJIS.CAPTIVE;
      case BT.DROP: return SPECIAL_EMOJIS.DROP;
      default: return "?";
    }
  };

  const getBgColor = () => {
    const type = bubble.type;
    if (type === BT.STONE) return 'bg-slate-500';
    if (type === BT.ICE) return 'bg-blue-100/60 backdrop-blur-sm border-2 border-blue-300';
    if (type === BT.WILD) return 'bg-gradient-to-tr from-purple-400 via-pink-400 to-yellow-400';
    return 'bg-white/10 backdrop-blur-sm border border-white/20';
  };

  return (
    <div
      className={`absolute flex items-center justify-center rounded-full shadow-lg transition-all duration-300 
        ${getBgColor()} ${isNew ? 'animate-appear' : ''} ${className || ''} pointer-events-none`}
      style={{
        width: BUBBLE_RADIUS * 2,
        height: BUBBLE_RADIUS * 2,
        fontSize: BUBBLE_RADIUS * 1.2,
        ...style
      }}
    >
      <span className="select-none drop-shadow-md">
        {getDisplayEmoji()}
      </span>
      {bubble.type === BT.ICE && bubble.innerBubble && (
        <div className="absolute opacity-40 scale-75">
          {bubble.innerBubble.emojiKey}
        </div>
      )}
      {(bubble.hp || 0) > 1 && (
        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white/20 shadow-sm">
          {bubble.hp}
        </div>
      )}
    </div>
  );
};

export default Bubble;
