import React, { useMemo, useEffect, useState } from 'react';
import { BreathPhase } from '../types';

interface BreathingCircleProps {
  phase: BreathPhase;
  prevPhase: BreathPhase; // Added to determine freeze size
  secondsLeft: number;
  totalDurationOfPhase: number;
  isActive: boolean;
  volume: number; 
  progress: number; 
  tickTrigger: number; 
  intensity: number; 
  overrideText?: string | null;
}

const BreathingCircle: React.FC<BreathingCircleProps> = ({ 
  phase, 
  prevPhase,
  secondsLeft, 
  totalDurationOfPhase, 
  isActive, 
  volume,
  progress,
  tickTrigger,
  intensity,
  overrideText
}) => {
  
  // State to handle the visual flash
  const [isBlinking, setIsBlinking] = useState(false);
  const [isTextBlinking, setIsTextBlinking] = useState(false);
  
  // State for the "Freeze" effect at start of step
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    if (isActive && tickTrigger > 0) {
      setIsBlinking(true);
      setIsTextBlinking(true);
      const timer = setTimeout(() => {
          setIsBlinking(false);
          setIsTextBlinking(false);
      }, 150); 
      return () => clearTimeout(timer);
    }
  }, [tickTrigger, isActive]);

  // Freeze logic on phase change
  useEffect(() => {
    if (isActive) {
        setIsFrozen(true);
        const timer = setTimeout(() => {
            setIsFrozen(false);
        }, 500);
        return () => clearTimeout(timer);
    } else {
        setIsFrozen(false);
    }
  }, [phase, isActive]);

  // Calculate scale for the main lung circle
  const scale = useMemo(() => {
    if (!isActive) return 0.75;
    
    if (phase === BreathPhase.INHALE) {
       // Inhale: 0.5 -> 1.0
       const p = 1 - (secondsLeft / totalDurationOfPhase);
       return 0.5 + (p * 0.5);
    } else if (phase === BreathPhase.EXHALE) {
       // Exhale: 1.0 -> 0.5
       const p = 1 - (secondsLeft / totalDurationOfPhase);
       return 1.0 - (p * 0.5);
    } else {
       // HOLD Phase: Freeze at the size of the PREVIOUS phase
       if (prevPhase === BreathPhase.INHALE) return 1.0; // Full lungs
       if (prevPhase === BreathPhase.EXHALE) return 0.5; // Empty lungs
       return 0.5 + (volume * 0.5); // Fallback
    }
  }, [phase, prevPhase, secondsLeft, totalDurationOfPhase, isActive, volume]);

  const getColor = () => {
    switch(phase) {
      case BreathPhase.INHALE: return 'bg-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.4)]';
      case BreathPhase.EXHALE: return 'bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.4)]';
      default: return 'bg-violet-500 shadow-[0_0_40px_rgba(139,92,246,0.3)]';
    }
  };

  const rotation = isActive ? progress * 360 : 0;

  return (
    <div className="relative w-72 h-72 flex items-center justify-center">
      {/* Outer Track (Static) */}
      <div className="absolute inset-0 rounded-full border border-slate-700/50"></div>
      
      {/* Runner (Orbiting Dot) */}
      {isActive && (
        <div 
            className="absolute inset-0 pointer-events-none will-change-transform"
            style={{ 
                transform: `rotate(${rotation}deg)` 
            }}
        >
            <div 
              className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full z-20 transition-all duration-150 ease-out
                  ${isBlinking 
                    ? 'w-6 h-6 bg-white shadow-[0_0_25px_rgba(255,255,255,1)] scale-125' 
                    : 'w-4 h-4 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] scale-100'
                  }
              `}
            ></div>
        </div>
      )}

      {/* Main Breathing Blob - Wrapper for transform/opacity (Fast) */}
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{ 
          transform: `scale(${scale})`,
          opacity: isActive ? intensity : 0.5,
          transition: 'transform 75ms linear, opacity 75ms linear',
          willChange: 'transform, opacity'
        }}
      >
          {/* Inner Blob - Wrapper for color/shadow (Slow 2s) */}
          <div className={`w-full h-full rounded-full transition-all duration-[2000ms] ease-in-out ${getColor()}`}>
          </div>
      </div>

      {/* Text Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 mix-blend-screen">
         {overrideText ? (
             <div className="flex flex-col items-center">
                <h2 className="text-6xl font-bold text-white tracking-tighter">{overrideText}</h2>
             </div>
         ) : (
            <h2 
                className={`text-6xl font-bold tracking-tighter tabular-nums transition-colors duration-100 ${
                    isFrozen
                    ? 'text-red-500 scale-110' // Freeze Style
                    : (isTextBlinking ? 'text-cyan-300' : 'text-white') // Normal Style
                }`}
            >
                {isActive 
                    ? (isFrozen ? totalDurationOfPhase.toFixed(1) : secondsLeft.toFixed(1)) 
                    : "0.0"
                }
            </h2>
         )}
      </div>
    </div>
  );
};

export default BreathingCircle;