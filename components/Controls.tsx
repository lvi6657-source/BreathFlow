import React, { useState, useRef, useEffect } from 'react';
import { BreathingStep, BreathPhase, SoundConfig } from '../types';

interface ControlsProps {
  isActive: boolean;
  adjustment: number;
  tickDuration: number; 
  phaseStartTime: number; 
  tickTrigger: number;
  onAdjustmentChange: (val: number) => void;
  onToggleActive: () => void;
  
  // Settings Mode
  settingsMode: 'DEFAULT' | 'STEPS' | 'SOUND';
  onToggleSettingsMode: () => void;

  minLimit: number;
  maxLimit: number;
  onLimitsChange: (min: number, max: number) => void;
  
  steps?: BreathingStep[];
  selectedStepIndex?: number;
  onSelectStep?: (index: number) => void;
  onStepChange?: (index: number, duration: number) => void;
  onStepTypeChange?: (index: number) => void;
  onAddStep?: (index: number) => void;
  onRemoveStep?: (index: number) => void;

  // Sound Config
  soundConfig: SoundConfig;
  onSoundConfigChange: (config: SoundConfig) => void;
  onDriftDurationChange?: (minutes: number) => void; 
  onOpenLibrary: () => void;
  
  // Live values
  liveFreqs?: { left: number; right: number };
  extraFreqs?: { carrier: number; dualLeft: number; dualRight: number };
  driftTimeRemaining?: number; // In Minutes (float)
  liveVolume?: number; // 0.0 to 1.0

  // Current Sound Mode Name (for display)
  soundModeName: string;
}

// Reusable Slider Component
export const SliderComponent: React.FC<{
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  onDoubleClick?: () => void;
  onLabelClick?: () => void; 
  onLongPress?: () => void;
  label: string;
  isCenterZero?: boolean;
  colorLeft?: string;
  colorRight?: string;
  unit?: string;
  clampMin?: number;
  clampMax?: number;
  highlight?: boolean;
  liveValue?: number;
  disabled?: boolean;
  customFontSize?: string; 
}> = ({ 
  value, 
  min = -10, 
  max = 10, 
  step = 0.1, 
  onChange, 
  onDoubleClick, 
  onLabelClick,
  onLongPress, 
  label, 
  isCenterZero = true, 
  colorLeft = "bg-orange-500/50", 
  colorRight = "bg-blue-500/50", 
  unit = "с", 
  clampMin, 
  clampMax,
  highlight = false,
  liveValue,
  disabled = false,
  customFontSize
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef(0);
    const startValRef = useRef(0);
    const pressIntervalRef = useRef<number | null>(null);
    const pressStartTimeRef = useRef<number>(0);
    const currentValueRef = useRef(value);
    const longPressTimerRef = useRef<number | null>(null);

    // If disabled, always show liveValue or value
    const displayValue = (disabled || !isDragging) ? (liveValue !== undefined ? liveValue : value) : value;

    useEffect(() => {
        currentValueRef.current = value;
    }, [value]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;
        setIsDragging(true);
        startXRef.current = e.clientX;
        startValRef.current = value;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);

        // Init Long Press
        if (onLongPress) {
            longPressTimerRef.current = window.setTimeout(() => {
                onLongPress();
                if (navigator.vibrate) navigator.vibrate(50);
                setIsDragging(false); // Cancel drag on long press
                longPressTimerRef.current = null;
            }, 600);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startXRef.current;
        
        // Cancel long press if moved significantly
        if (Math.abs(deltaX) > 10 && longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        const steps = Math.round(deltaX / 15); 
        let newValue = startValRef.current + (steps * step);
        newValue = Math.round(newValue * 100) / 100; 
        
        if (clampMin !== undefined) newValue = Math.max(clampMin, newValue);
        if (clampMax !== undefined) newValue = Math.min(clampMax, newValue);
        if (min !== undefined) newValue = Math.max(min, newValue);
        if (max !== undefined) newValue = Math.min(max, newValue);

        if (newValue !== value) {
            onChange(newValue);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        setIsDragging(false);
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    };

    const calculateNextValue = (prev: number, delta: number) => {
        let n = Number((prev + delta).toFixed(2));
        if (clampMin !== undefined) n = Math.max(clampMin, n);
        if (clampMax !== undefined) n = Math.min(clampMax, n);
        if (min !== undefined) n = Math.max(min, n);
        if (max !== undefined) n = Math.min(max, n);
        return n;
    };

    const startContinuousChange = (direction: number) => {
        if (disabled) return;
        pressStartTimeRef.current = Date.now();
        const next = calculateNextValue(currentValueRef.current, direction * step);
        onChange(next);
        if (pressIntervalRef.current) clearInterval(pressIntervalRef.current);
        pressIntervalRef.current = window.setInterval(() => {
            const elapsed = Date.now() - pressStartTimeRef.current;
            let currentStep = step;
            if (elapsed > 2000) currentStep = step * 10;   
            if (elapsed > 5000) currentStep = step * 100;  
            const newVal = calculateNextValue(currentValueRef.current, direction * currentStep);
            onChange(newVal);
        }, 100);
    };

    const stopContinuousChange = () => {
        if (pressIntervalRef.current) {
            clearInterval(pressIntervalRef.current);
            pressIntervalRef.current = null;
        }
    };

    return (
        <div 
            className={`relative w-full h-full bg-slate-900 flex items-center justify-between px-1 touch-none select-none border-x border-slate-800 first:border-l-0 last:border-r-0 ${highlight ? 'bg-indigo-900/30' : ''} ${disabled ? 'opacity-80' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={(e) => {
                if(!disabled && e.target === e.currentTarget && onDoubleClick) onDoubleClick();
            }}
        >
            <button 
                className={`w-10 h-full flex items-center justify-center touch-none z-20 ${disabled ? 'text-slate-700' : 'text-slate-500 hover:text-white active:scale-90'}`}
                onPointerDown={(e) => { e.stopPropagation(); startContinuousChange(-1); }}
                onPointerUp={(e) => { e.stopPropagation(); stopContinuousChange(); }}
                onPointerLeave={(e) => { e.stopPropagation(); stopContinuousChange(); }}
                onDoubleClick={(e) => e.stopPropagation()} 
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>

            <div className={`flex flex-col items-center justify-center pointer-events-none z-20 ${isDragging ? 'scale-110' : 'scale-100'} transition-transform duration-75`}>
                <button 
                    onClick={(e) => {
                        if (onLabelClick && !disabled) {
                            e.stopPropagation();
                            onLabelClick();
                        }
                    }}
                    className={`text-[10px] uppercase font-bold tracking-widest mb-1 leading-none ${highlight ? 'text-indigo-300' : 'text-slate-500'} ${onLabelClick && !disabled ? 'pointer-events-auto hover:text-white cursor-pointer' : ''}`}
                >
                    {label}
                </button>
                <div 
                    className={`font-mono font-bold leading-none ${highlight ? 'text-indigo-400' : (isCenterZero ? (displayValue > 0 ? 'text-blue-400' : displayValue < 0 ? 'text-orange-400' : 'text-white') : 'text-white')}`} 
                    style={{fontSize: customFontSize ? customFontSize : (isCenterZero ? '2rem' : '1.5rem')}}
                >
                    {isCenterZero && displayValue > 0 ? '+' : ''}{Number.isInteger(displayValue) ? displayValue : displayValue.toFixed(1)}<span className="text-xs text-slate-600 ml-0.5">{unit}</span>
                </div>
            </div>

            <button 
                className={`w-10 h-full flex items-center justify-center touch-none z-20 ${disabled ? 'text-slate-700' : 'text-slate-500 hover:text-white active:scale-90'}`}
                onPointerDown={(e) => { e.stopPropagation(); startContinuousChange(1); }}
                onPointerUp={(e) => { e.stopPropagation(); stopContinuousChange(); }}
                onPointerLeave={(e) => { e.stopPropagation(); stopContinuousChange(); }}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            
            {isCenterZero && (
                <>
                    <div className={`absolute bottom-0 h-1 ${colorRight} z-10`} style={{ left: '50%', width: displayValue > 0 ? `${Math.min(50, Math.abs(displayValue) * 10)}%` : '0%' }}></div>
                    <div className={`absolute bottom-0 h-1 ${colorLeft} z-10`} style={{ right: '50%', width: displayValue < 0 ? `${Math.min(50, Math.abs(displayValue) * 10)}%` : '0%' }}></div>
                </>
            )}
        </div>
    );
};

export const StepControlPanel: React.FC<{
    stepIndex: number;
    totalSteps: number;
    stepType: BreathPhase;
    onPrev: () => void;
    onNext: () => void;
    onToggleType: () => void;
    onAdd: () => void;
    onRemove: () => void;
}> = ({ stepIndex, totalSteps, stepType, onPrev, onNext, onToggleType, onAdd, onRemove }) => {
    
    const getPhaseIcon = (phase: BreathPhase) => {
        switch(phase) {
            case BreathPhase.INHALE: 
              return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>;
            case BreathPhase.EXHALE:
              return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>;
            default:
              return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400"><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
        }
    };

    return (
        <div className="w-full h-full bg-slate-900 flex items-center justify-between px-0">
             <button onClick={onPrev} className="h-full w-12 flex items-center justify-center text-slate-500 hover:text-white active:scale-90">
                 <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
             </button>
             <div className="flex flex-col items-center gap-1">
                 <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none">ШАГ {stepIndex + 1}</span>
                 <div className="flex items-center gap-4">
                     <button onClick={onRemove} className="text-slate-500 hover:text-red-400 active:scale-90 p-1" title="Удалить текущий">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                     </button>
                     <button onClick={onToggleType} className="hover:scale-110 active:scale-95 transition-transform p-1">
                        {getPhaseIcon(stepType)}
                     </button>
                     <button onClick={onAdd} className="text-slate-500 hover:text-white active:scale-90 p-1" title="Добавить шаг">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                     </button>
                 </div>
             </div>
             <button onClick={onNext} className="h-full w-12 flex items-center justify-center text-slate-500 hover:text-white active:scale-90">
                 <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
             </button>
        </div>
    );
}

const Controls: React.FC<ControlsProps> = (props) => {
  const { 
    isActive, 
    adjustment,
    tickDuration,
    phaseStartTime,
    tickTrigger,
    onAdjustmentChange,
    onToggleActive, 
    settingsMode,
    onToggleSettingsMode,
    onOpenLibrary,
    minLimit,
    maxLimit,
    onLimitsChange,
    steps,
    selectedStepIndex = 0,
    onSelectStep,
    onStepChange,
    onStepTypeChange,
    onAddStep,
    onRemoveStep,
    soundConfig,
    onSoundConfigChange,
    onDriftDurationChange,
    liveFreqs,
    extraFreqs,
    driftTimeRemaining,
    liveVolume = 0,
    soundModeName
  } = props;

  const [isFlashing, setIsFlashing] = useState(false);
  const [pendulumMode, setPendulumMode] = useState<0 | 1 | 2 | 3>(0);
  const pendulumRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const longPressTimerRef = useRef<number | null>(null);

  // Remembers last used non-zero multiplier for toggling
  const lastCarrierMult = useRef(1);
  const lastDualMult = useRef(1);

  useEffect(() => {
      if (isActive && tickTrigger > 0) {
          setIsFlashing(true);
          const t = setTimeout(() => setIsFlashing(false), 150);
          return () => clearTimeout(t);
      }
  }, [tickTrigger, isActive]);

  const togglePendulumMode = () => setPendulumMode(prev => (prev + 1) % 4 as 0 | 1 | 2 | 3);

  const animatePendulum = () => {
    if (isActive && phaseStartTime > 0) {
      const now = Date.now();
      const timeElapsedInPhase = (now - phaseStartTime) / 1000; 
      const safeDuration = Math.max(0.1, tickDuration);
      const totalTicksElapsed = timeElapsedInPhase / safeDuration;

      let position = 0; 
      const angleRad = totalTicksElapsed * Math.PI;

      if (pendulumMode === 0) position = -Math.cos(angleRad);
      else if (pendulumMode === 1) {
          const t = totalTicksElapsed % 2; 
          if (t < 1) position = -1 + (2 * t);
          else position = 1 - (2 * (t - 1));
      }
      else if (pendulumMode === 2) {
          const t = totalTicksElapsed % 2; 
          let linPos = 0;
          if (t < 1) linPos = -1 + (2 * t);
          else linPos = 1 - (2 * (t - 1));
          position = linPos * linPos * linPos; 
      }
      else if (pendulumMode === 3) {
          const t = totalTicksElapsed % 2; 
          let linPos = 0;
          if (t < 1) linPos = -1 + (2 * t);
          else linPos = 1 - (2 * (t - 1));
          position = Math.cbrt(linPos);
      }
      const x = position * 170; 
      if (pendulumRef.current) pendulumRef.current.style.transform = `translate(${x}px, -50%)`;
      requestRef.current = requestAnimationFrame(animatePendulum);
    }
  };

  useEffect(() => {
    if (isActive) requestRef.current = requestAnimationFrame(animatePendulum);
    else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (pendulumRef.current) pendulumRef.current.style.transform = `translate(-50%, -50%)`;
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isActive, phaseStartTime, tickDuration, pendulumMode]);

  const getModeName = (m: number) => {
      switch(m) {
          case 0: return "Гармоника";
          case 1: return "Линейный";
          case 2: return "Инверсия";
          case 3: return "Зеркальный";
          default: return "";
      }
  };

  const currentStep = steps ? steps[selectedStepIndex] : null;
  const isBinaural = soundModeName === 'Бинауральный';
  const isDrift = soundConfig.driftMode !== 'NONE';

  const toggleDrift = (target: 'LEFT' | 'RIGHT') => {
      if (!isBinaural) return;
      const isLeft = target === 'LEFT';
      const newMode = isLeft ? 'LEFT_TO_RIGHT' : 'RIGHT_TO_LEFT';
      
      if (soundConfig.driftMode === newMode) {
          onSoundConfigChange({...soundConfig, driftMode: 'NONE'});
      } else {
          onSoundConfigChange({...soundConfig, driftMode: newMode});
      }
  };

  // Logic to toggle Carrier mode
  const toggleCarrierMode = () => {
      const newMode = soundConfig.driftCarrierMode === 'HARMONIC' ? 'DIFFERENCE' : 'HARMONIC';
      onSoundConfigChange({...soundConfig, driftCarrierMode: newMode});
      if (navigator.vibrate) navigator.vibrate([50, 50]);
  };

  // Logic to toggle Dual mode
  const toggleDualMode = () => {
      // Use fallback if dualMode is undefined (though it should be initialized)
      const currentMode = soundConfig.dualMode || 'HARMONIC';
      const newMode = currentMode === 'HARMONIC' ? 'DIFFERENCE' : 'HARMONIC';
      onSoundConfigChange({...soundConfig, dualMode: newMode});
      if (navigator.vibrate) navigator.vibrate([50, 50]);
  };

  // Logic to mute/unmute Carrier
  const toggleCarrier = () => {
      if (soundConfig.binauralMultiplier !== 0) {
          lastCarrierMult.current = soundConfig.binauralMultiplier;
          onSoundConfigChange({...soundConfig, binauralMultiplier: 0});
      } else {
          onSoundConfigChange({...soundConfig, binauralMultiplier: lastCarrierMult.current});
      }
  };

  // Logic to mute/unmute Dual
  const toggleDual = () => {
      if (soundConfig.binauralDualMultiplier !== 0) {
          lastDualMult.current = soundConfig.binauralDualMultiplier;
          onSoundConfigChange({...soundConfig, binauralDualMultiplier: 0});
      } else {
          onSoundConfigChange({...soundConfig, binauralDualMultiplier: lastDualMult.current});
      }
  };

  // Helper to render the Drift/Volume cell
  const renderDriftCell = (isDrifting: boolean) => {
      if (isDrifting) {
          return (
             <div className="flex flex-col h-full w-full">
                {/* Time Remaining Slider (Top Half of Cell) */}
                <div className="h-3/5 border-b border-slate-800">
                    <SliderComponent 
                        value={isActive && driftTimeRemaining !== undefined ? driftTimeRemaining : soundConfig.driftDurationMinutes}
                        onChange={(v) => onDriftDurationChange ? onDriftDurationChange(v) : onSoundConfigChange({...soundConfig, driftDurationMinutes: v})}
                        label={isActive ? "Осталось (мин)" : "Время (мин)"}
                        isCenterZero={false} min={1} max={60} step={1} unit="м"
                        highlight={true}
                    />
                </div>
                {/* Target Difference Slider (Bottom Half of Cell) */}
                <div className="h-2/5">
                    <SliderComponent 
                        value={soundConfig.driftTargetDiff || 0}
                        onChange={(v) => onSoundConfigChange({...soundConfig, driftTargetDiff: v})}
                        label="Разница (Hz)"
                        isCenterZero={false} min={0} max={40} step={0.1} unit="Hz"
                        highlight={true}
                        colorRight="bg-indigo-500/50"
                    />
                </div>
             </div>
          );
      }
      return null;
  };
  
  // Helper to render Multiplier Sliders (Stacked) - MATCHES DRIFT CELL LAYOUT
  const renderMultiplierSliders = () => {
      return (
        <div className="flex flex-col h-full w-full">
            <div className="h-3/5 border-b border-slate-800">
                <SliderComponent 
                    value={soundConfig.binauralMultiplier || 0}
                    onChange={(v) => onSoundConfigChange({...soundConfig, binauralMultiplier: v})}
                    label={soundConfig.driftCarrierMode === 'DIFFERENCE' ? "Несущая (Diff)" : "Несущая"}
                    onLabelClick={toggleCarrier}
                    onLongPress={toggleCarrierMode}
                    isCenterZero={true} min={-10} max={10} step={1} unit="x"
                    highlight={soundConfig.binauralMultiplier !== 0}
                    colorLeft="bg-purple-500/50" colorRight="bg-purple-500/50"
                    customFontSize="1.5rem"
                />
            </div>
            <div className="h-2/5">
                <SliderComponent 
                    value={soundConfig.binauralDualMultiplier || 0}
                    onChange={(v) => onSoundConfigChange({...soundConfig, binauralDualMultiplier: v})}
                    label={soundConfig.dualMode === 'DIFFERENCE' ? "Дубль (Diff)" : "Дубль"}
                    onLabelClick={toggleDual}
                    onLongPress={toggleDualMode}
                    isCenterZero={true} min={-10} max={10} step={1} unit="x"
                    highlight={soundConfig.binauralDualMultiplier !== 0}
                    colorLeft="bg-emerald-500/50" colorRight="bg-emerald-500/50"
                    customFontSize="1.5rem"
                />
            </div>
        </div>
      );
  };

  return (
    <div className="w-full max-w-md px-0 pb-0 flex flex-col items-center">
        
        {/* PENDULUM & VISUALIZER AREA */}
        <div className="w-full px-4 h-16 relative mb-0 cursor-pointer overflow-visible" onClick={togglePendulumMode}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-800/10"></div>
            
            {/* IN-PLACE VISUALIZER */}
            {isBinaural && liveFreqs && extraFreqs && (
                <div className="absolute top-0 left-0 w-full flex items-start justify-between px-2 text-xs font-mono pointer-events-none z-10 -mt-10">
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="text-cyan-400 font-bold tracking-wider text-base">{liveFreqs.left.toFixed(2)}</span>
                        <span className="text-emerald-500 font-bold tracking-wider opacity-60 text-base">{extraFreqs.dualLeft.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <span className="text-purple-400 font-bold text-base">{extraFreqs.carrier.toFixed(2)}</span>
                        <span className="text-slate-500 font-bold text-[10px] mt-0.5">{Math.round(liveVolume * 100)}%</span>
                    </div>
                    
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-blue-400 font-bold tracking-wider text-base">{liveFreqs.right.toFixed(2)}</span>
                        <span className="text-emerald-500 font-bold tracking-wider opacity-60 text-base">{extraFreqs.dualRight.toFixed(2)}</span>
                    </div>
                </div>
            )}
            
            {!isBinaural && !isActive && <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-700 uppercase tracking-widest font-bold">{getModeName(pendulumMode)}</div>}
            
            {/* PENDULUM BALL */}
            <div ref={pendulumRef} className={`absolute top-1/2 left-1/2 rounded-full will-change-transform transition-all duration-75 z-20 ${isFlashing ? 'w-5 h-5 bg-white shadow-[0_0_30px_rgba(255,255,255,1)]' : 'w-4 h-4 bg-calm-accent shadow-[0_0_20px_rgba(56,189,248,0.8)]'}`} style={{ transform: 'translate(-50%, -50%)' }}></div>
        </div>

        {/* INTERACTIVE AREA */}
        <div className="w-full border-t border-slate-800 flex flex-col">
            {settingsMode === 'STEPS' && steps && currentStep ? (
                // --- STEPS EDIT MODE ---
                <>
                    <div className="w-full h-20 flex relative border-b border-slate-800">
                        <div className="w-1/2 h-full border-r border-slate-800">
                            <StepControlPanel stepIndex={selectedStepIndex} totalSteps={steps.length} stepType={currentStep.type} onPrev={() => onSelectStep && onSelectStep((selectedStepIndex - 1 + steps.length) % steps.length)} onNext={() => onSelectStep && onSelectStep((selectedStepIndex + 1) % steps.length)} onToggleType={() => onStepTypeChange && onStepTypeChange(selectedStepIndex)} onAdd={() => onAddStep && onAddStep(selectedStepIndex)} onRemove={() => onRemoveStep && onRemoveStep(selectedStepIndex)} />
                        </div>
                        <div className="w-1/2 h-full relative">
                           <SliderComponent value={minLimit} onChange={(v) => onLimitsChange(v, maxLimit)} label="Мин. Цикл" isCenterZero={false} clampMin={2} clampMax={maxLimit - 1} min={2} max={60} unit="с" step={1} />
                        </div>
                    </div>
                    <div className="w-full h-20 flex relative">
                        <div className="w-1/2 h-full border-r border-slate-800">
                             <SliderComponent value={currentStep.duration} onChange={(v) => onStepChange && onStepChange(selectedStepIndex, v)} label="Длительность" isCenterZero={false} clampMin={0.5} clampMax={30} min={0} max={30} unit="с" step={0.5} />
                        </div>
                        <div className="w-1/2 h-full">
                             <SliderComponent value={maxLimit} onChange={(v) => onLimitsChange(minLimit, v)} label="Макс. Цикл" isCenterZero={false} clampMin={minLimit + 1} clampMax={60} min={4} max={60} unit="с" step={1} />
                        </div>
                    </div>
                </>
            ) : settingsMode === 'SOUND' ? (
                // --- SOUND SETTINGS MODE ---
                <div className="w-full flex h-40"> 
                    {/* Left Column (Frequencies) */}
                    <div className="w-1/2 h-full flex flex-col border-r border-slate-800">
                        <div className="h-1/2 border-b border-slate-800">
                             <SliderComponent 
                                value={isBinaural ? soundConfig.binauralLeftFreq : soundConfig.maxFreq}
                                liveValue={isBinaural ? liveFreqs?.left : undefined}
                                disabled={isBinaural && soundConfig.driftMode === 'LEFT_TO_RIGHT' && isActive}
                                onChange={(v) => isBinaural ? onSoundConfigChange({...soundConfig, binauralLeftFreq: v}) : onSoundConfigChange({...soundConfig, maxFreq: v})}
                                onLongPress={() => {
                                    if (isBinaural) {
                                        if (!isDrift) onSoundConfigChange({...soundConfig, binauralLeftFreq: soundConfig.binauralRightFreq});
                                    } else {
                                        onSoundConfigChange({...soundConfig, maxFreq: soundConfig.minFreq});
                                    }
                                }}
                                onLabelClick={isBinaural ? () => toggleDrift('LEFT') : undefined}
                                label={isBinaural ? "Левый канал" : "Макс. Частота"}
                                highlight={soundConfig.driftMode === 'LEFT_TO_RIGHT'}
                                isCenterZero={false} min={20} max={isBinaural ? 1000 : 10000} step={isBinaural ? 0.1 : 5} unit="Hz"
                            />
                        </div>
                        <div className="h-1/2">
                             <SliderComponent 
                                value={isBinaural ? soundConfig.binauralRightFreq : soundConfig.minFreq}
                                liveValue={isBinaural ? liveFreqs?.right : undefined}
                                disabled={isBinaural && soundConfig.driftMode === 'RIGHT_TO_LEFT' && isActive}
                                onChange={(v) => isBinaural ? onSoundConfigChange({...soundConfig, binauralRightFreq: v}) : onSoundConfigChange({...soundConfig, minFreq: v})}
                                onLongPress={() => {
                                    if (isBinaural) {
                                        if (!isDrift) onSoundConfigChange({...soundConfig, binauralRightFreq: soundConfig.binauralLeftFreq});
                                    } else {
                                        onSoundConfigChange({...soundConfig, minFreq: soundConfig.maxFreq});
                                    }
                                }}
                                onLabelClick={isBinaural ? () => toggleDrift('RIGHT') : undefined}
                                label={isBinaural ? "Правый канал" : "Мин. Частота"}
                                highlight={soundConfig.driftMode === 'RIGHT_TO_LEFT'}
                                isCenterZero={false} min={20} max={isBinaural ? 1000 : 10000} step={isBinaural ? 0.1 : 5} unit="Hz"
                            />
                        </div>
                    </div>
                    {/* Right Column (Volume OR Time/Diff/Multiplier) */}
                    <div className="w-full flex flex-col w-1/2">
                        <div className="h-1/2 border-b border-slate-800">
                             {isBinaural && soundConfig.driftMode === 'LEFT_TO_RIGHT' ? renderDriftCell(true) : (
                                isBinaural && soundConfig.driftMode === 'RIGHT_TO_LEFT' ? renderMultiplierSliders() : (
                                    <SliderComponent 
                                        value={Math.round(soundConfig.maxVol * 100)}
                                        onChange={(v) => onSoundConfigChange({...soundConfig, maxVol: v / 100})}
                                        label="Макс. Громкость"
                                        isCenterZero={false} min={0} max={100} step={1} unit="%"
                                    />
                                )
                             )}
                        </div>
                        <div className="h-1/2">
                            {isBinaural && soundConfig.driftMode === 'RIGHT_TO_LEFT' ? renderDriftCell(true) : (
                                isBinaural && soundConfig.driftMode === 'LEFT_TO_RIGHT' ? renderMultiplierSliders() : (
                                    <SliderComponent 
                                        value={Math.round(soundConfig.minVol * 100)}
                                        onChange={(v) => onSoundConfigChange({...soundConfig, minVol: v / 100})}
                                        label="Мин. Громкость"
                                        isCenterZero={false} min={0} max={100} step={1} unit="%"
                                    />
                                )
                             )}
                        </div>
                    </div>
                </div>
            ) : (
                // --- MAIN ADJUSTMENT VIEW ---
                <div className="w-full h-20">
                    <SliderComponent 
                        value={adjustment} onChange={onAdjustmentChange} onDoubleClick={() => onAdjustmentChange(0)} label={adjustment === 0 ? 'Норма' : adjustment > 0 ? 'Замедление' : 'Ускорение'} isCenterZero={true} clampMin={-5} clampMax={5} min={-5} max={5} unit="с"
                    />
                </div>
            )}
        </div>
        
        {/* BUTTON GRID */}
        <div className="w-full grid grid-cols-4 gap-px bg-slate-800 border-t border-slate-800">
            <button 
                onClick={onToggleSettingsMode} 
                className={`h-20 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white active:bg-slate-700 flex flex-col items-center justify-center transition-colors ${settingsMode !== 'DEFAULT' ? 'text-calm-accent bg-slate-800' : ''}`}
            >
                {settingsMode === 'DEFAULT' && <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>}
                {settingsMode === 'STEPS' && <div className="flex flex-col items-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg><span className="text-[10px] uppercase font-bold mt-1">Шаги</span></div>}
                {settingsMode === 'SOUND' && (
                    <div className={`flex flex-col items-center`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                        <span className="text-[10px] uppercase font-bold mt-1">Звук</span>
                    </div>
                )}
            </button>
            <button onClick={onToggleActive} className={`col-span-2 h-20 text-xl font-bold tracking-widest uppercase flex items-center justify-center transition-colors ${isActive ? 'bg-rose-900/40 text-rose-400 hover:bg-rose-900/60' : 'bg-calm-accent/10 text-calm-accent hover:bg-calm-accent/20'}`}>
                {isActive ? 'Стоп' : 'Старт'}
            </button>
            <button onClick={onOpenLibrary} className="h-20 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white active:bg-slate-700 flex flex-col items-center justify-center transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
        </div>
    </div>
  );
};

export default Controls;