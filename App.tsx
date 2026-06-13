import React, { useState, useEffect, useRef, useCallback } from 'react';
import BreathingCircle from './components/BreathingCircle';
import Controls from './components/Controls';
import SettingsModal from './components/SettingsModal';
import AIModal from './components/AIModal';
import { BreathingPattern, PRESETS, BreathPhase, SoundConfig, SoundMode } from './types';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  // --- Library State (Persisted) ---
  const [patterns, setPatterns] = useState<BreathingPattern[]>(() => {
    try {
        const saved = localStorage.getItem('breathflow_patterns_v2');
        if (saved) return JSON.parse(saved);
        return PRESETS;
    } catch {
        return PRESETS;
    }
  });

  // --- Session State (Live) ---
  const [activePattern, setActivePattern] = useState<BreathingPattern>(patterns[0]);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0); 
  const [isCustomized, setIsCustomized] = useState(false);
  const [isMinimalist, setIsMinimalist] = useState(false); // Zen Mode
  
  const [isActive, setIsActive] = useState(false);
  const [soundMode, setSoundMode] = useState<SoundMode>(SoundMode.TONES);

  // Settings Modes
  const [settingsMode, setSettingsMode] = useState<'DEFAULT' | 'STEPS' | 'SOUND'>('DEFAULT');

  // Sound Config
  const [soundConfig, setSoundConfig] = useState<SoundConfig>({
      minFreq: 200,
      maxFreq: 400,
      binauralLeftFreq: 200,
      binauralRightFreq: 210,
      binauralMultiplier: 0, // Carrier
      binauralDualMultiplier: 0, // Dual
      
      driftMode: 'NONE',
      driftCarrierMode: 'HARMONIC',
      dualMode: 'HARMONIC', // Independent mode for Dual
      driftDurationMinutes: 10,
      driftTargetDiff: 0, 
      driftStartTime: null,
      driftStartFreq: null,

      minVol: 0.1,
      maxVol: 0.5,
      ticksEnabled: true,
      isEnabled: true
  });

  // LIVE Frequencies & Time for UI Visualization
  const [liveFreqs, setLiveFreqs] = useState({ left: 200, right: 210 });
  const [extraFreqs, setExtraFreqs] = useState({ carrier: 0, dualLeft: 0, dualRight: 0 }); // New State for Visualizer
  const [driftTimeRemaining, setDriftTimeRemaining] = useState<number>(10);
  const [liveVolume, setLiveVolume] = useState<number>(0);

  // Execution state (Visuals)
  const [stepIndex, setStepIndex] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0); 
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0); 
  const [prevPhase, setPrevPhase] = useState<BreathPhase>(BreathPhase.EXHALE);
  
  // Cycle Accumulation Logic
  const [currentCycleTotal, setCurrentCycleTotal] = useState(0); 
  const [adjustmentPerCycle, setAdjustmentPerCycle] = useState(0);

  // Logic Refs
  const stateRef = useRef({
      stepIndex: 0,
      phaseStartTime: 0,
      currentDuration: 4,
      pattern: patterns[0], 
      prevPhase: BreathPhase.EXHALE, // Track previous for audio hold logic
      
      currentCycleTotal: 0, 
      adjustmentPerCycle: 0,

      ticksPerPhase: 4, 
      mainTicksPerPhase: 1, 
      isActive: false,
      soundConfig: soundConfig,
      lastStepIndex: -1,
      
      // Strict Beat Tracking
      lastMainTickIndex: -1,
      lastSubTickIndex: -1
  });

  // Tick Logic State
  const [ticksPerPhase, setTicksPerPhase] = useState(4);      
  const [mainTicksPerPhase, setMainTicksPerPhase] = useState(1); 
  const [tickTrigger, setTickTrigger] = useState(0); 

  // Master Time
  const [phaseStartTime, setPhaseStartTime] = useState<number>(0);
  
  // Animation state
  const [volume, setVolume] = useState(0.5); 
  const [showTickOverlay, setShowTickOverlay] = useState<'LEFT' | 'RIGHT' | 'CENTER' | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);

  // Refs for Gestures
  const rightGestureStartY = useRef<number>(0);
  const rightGestureStartValue = useRef<number>(0);
  const leftGestureStartY = useRef<number>(0);
  const leftGestureStartValue = useRef<number>(0);
  const centerGestureStartY = useRef<number>(0);
  const centerGestureStartValue = useRef<number>(0);
  const requestRef = useRef<number>();

  // --- Sync Refs with State ---
  useEffect(() => {
    stateRef.current.pattern = activePattern;
    stateRef.current.ticksPerPhase = ticksPerPhase;
    stateRef.current.mainTicksPerPhase = mainTicksPerPhase;
    stateRef.current.isActive = isActive;
    stateRef.current.soundConfig = soundConfig;
    
    // Sync Cycle Logic to Ref
    stateRef.current.currentCycleTotal = currentCycleTotal;
    stateRef.current.adjustmentPerCycle = adjustmentPerCycle;

    if (soundMode === SoundMode.BINAURAL) {
         // !!! FIX: Explicitly set mode to BINAURAL, otherwise it stays in TONES/SILENCE
         audioService.setMode(SoundMode.BINAURAL);

         if (soundConfig.driftMode !== 'NONE' && !soundConfig.driftStartTime) {
             const now = Date.now();
             const startFreq = soundConfig.driftMode === 'LEFT_TO_RIGHT' 
                ? soundConfig.binauralLeftFreq 
                : soundConfig.binauralRightFreq;
             
             stateRef.current.soundConfig = {
                 ...soundConfig,
                 driftStartTime: now,
                 driftStartFreq: startFreq
             };
             setSoundConfig(prev => ({ ...prev, driftStartTime: now, driftStartFreq: startFreq }));
             setDriftTimeRemaining(soundConfig.driftDurationMinutes);
         } 
         else if (soundConfig.driftMode === 'NONE' && soundConfig.driftStartTime) {
             setSoundConfig(prev => ({ ...prev, driftStartTime: null, driftStartFreq: null }));
             setLiveFreqs({ left: soundConfig.binauralLeftFreq, right: soundConfig.binauralRightFreq });
             setDriftTimeRemaining(soundConfig.driftDurationMinutes);
         }
         
         if (!isActive && soundConfig.driftMode === 'NONE') {
            const freqs = audioService.updateLiveParameters(
                soundConfig.binauralLeftFreq, 
                soundConfig.binauralRightFreq, 
                soundConfig.binauralMultiplier || 0,
                soundConfig.binauralDualMultiplier || 0,
                soundConfig.driftCarrierMode,
                soundConfig.dualMode
            );
            setLiveFreqs({ left: soundConfig.binauralLeftFreq, right: soundConfig.binauralRightFreq });
            if (freqs) setExtraFreqs({ carrier: freqs.carrier, dualLeft: freqs.dualLeft, dualRight: freqs.dualRight });
         }
    } else {
        audioService.setMode(soundMode);
    }
  }, [activePattern, ticksPerPhase, mainTicksPerPhase, isActive, currentCycleTotal, adjustmentPerCycle, soundConfig, soundMode]);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('breathflow_patterns_v2', JSON.stringify(patterns));
  }, [patterns]);

  // --- Helpers ---
  const handleSavePattern = (newPattern: BreathingPattern) => {
    setPatterns(prev => {
      const exists = prev.find(p => p.id === newPattern.id);
      if (exists) {
        return prev.map(p => p.id === newPattern.id ? newPattern : p);
      } else {
        return [...prev, newPattern];
      }
    });
    if (activePattern.id === newPattern.id) {
        setActivePattern(newPattern);
        setIsCustomized(false);
    }
  };
  
  const handleSaveSessionAsNew = () => {
      const newPattern = {
          ...activePattern,
          id: crypto.randomUUID(),
          name: `${activePattern.name} (Копия)`,
      };
      handleSavePattern(newPattern);
      setActivePattern(newPattern);
      setIsCustomized(false);
      alert("Текущие настройки сохранены как новый ритм");
  };

  const handleDeletePattern = (id: string) => {
    const newPatterns = patterns.filter(p => p.id !== id);
    if (newPatterns.length === 0) {
        setPatterns(PRESETS);
        setActivePattern(PRESETS[0]);
        resetSession(PRESETS[0], true);
    } else {
        setPatterns(newPatterns);
        if (activePattern.id === id) {
            setActivePattern(newPatterns[0]);
            resetSession(newPatterns[0], true);
        }
    }
    setIsCustomized(false);
  };

  const calculateTotalBaseDuration = (p: BreathingPattern) => {
      return p.steps.reduce((acc, s) => acc + s.duration, 0);
  };

  const calculateTimeToLimit = () => {
      if (adjustmentPerCycle === 0 || !isActive) return null;
      
      const current = currentCycleTotal;
      const isSpeedingUp = adjustmentPerCycle < 0;
      const limit = isSpeedingUp ? (activePattern.minCycleDuration || 4) : (activePattern.maxCycleDuration || 60);
      
      if (isSpeedingUp && current <= limit) return "МАКС";
      if (!isSpeedingUp && current >= limit) return "МАКС";
      
      const step = adjustmentPerCycle; 
      const stepsCount = Math.ceil((limit - current) / step);
      
      if (stepsCount <= 0) return "МАКС";
      
      const totalSecondsLeft = (stepsCount / 2) * (2 * current + (stepsCount - 1) * step);
      const m = Math.floor(Math.abs(totalSecondsLeft) / 60);
      const s = Math.floor(Math.abs(totalSecondsLeft) % 60);
      
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const resetSession = useCallback((pattern: BreathingPattern, hardReset: boolean = false) => {
    setIsActive(false);
    audioService.stopTone(); 
    stateRef.current.isActive = false;
    stateRef.current.lastStepIndex = -1;
    stateRef.current.lastMainTickIndex = -1;
    stateRef.current.lastSubTickIndex = -1;
    
    const baseTotal = calculateTotalBaseDuration(pattern);
    
    if (hardReset) {
        setAdjustmentPerCycle(pattern.adjustmentPerCycle);
        stateRef.current.adjustmentPerCycle = pattern.adjustmentPerCycle;
        setIsCustomized(false);
    }

    setCurrentCycleTotal(baseTotal);
    stateRef.current.currentCycleTotal = baseTotal;

    const firstValidIndex = pattern.steps.findIndex(s => s.duration > 0);
    const validIndex = firstValidIndex === -1 ? 0 : firstValidIndex;
    
    stateRef.current.stepIndex = validIndex;
    stateRef.current.currentDuration = pattern.steps[validIndex]?.duration || 4;
    stateRef.current.prevPhase = BreathPhase.EXHALE;

    setStepIndex(validIndex);
    setCurrentDuration(pattern.steps[validIndex]?.duration || 4);
    setSecondsLeft(pattern.steps[validIndex]?.duration || 4);
    setPhaseProgress(0);
    setVolume(0.5); 
    setLiveVolume(0);
    setPrevPhase(BreathPhase.EXHALE); 
    
    setPhaseStartTime(0);
    setDriftTimeRemaining(soundConfig.driftDurationMinutes);
  }, [soundConfig.driftDurationMinutes]); 

  const handleToggleActive = () => {
      if (isActive) {
          resetSession(activePattern, false); 
      } else {
          setIsActive(true);
      }
  };

  const handleDriftDurationChange = (newMinutes: number) => {
      let currentFreq = soundConfig.driftMode === 'LEFT_TO_RIGHT' ? soundConfig.binauralLeftFreq : soundConfig.binauralRightFreq;
      
      if (isActive && soundConfig.driftMode !== 'NONE' && soundConfig.driftStartTime && soundConfig.driftStartFreq) {
          const driftElapsedMs = Date.now() - soundConfig.driftStartTime;
          const totalDriftMs = soundConfig.driftDurationMinutes * 60 * 1000;
          const progress = Math.min(1, driftElapsedMs / totalDriftMs);
          
          const start = soundConfig.driftStartFreq;
          const targetConfig = soundConfig.driftMode === 'LEFT_TO_RIGHT' ? soundConfig.binauralRightFreq : soundConfig.binauralLeftFreq;
          const offset = soundConfig.driftTargetDiff || 0;
          const actualTarget = start < targetConfig ? targetConfig - offset : targetConfig + offset;
          
          currentFreq = start + (actualTarget - start) * progress;
      }
      
      const now = Date.now();
      const newConfig = {
          ...soundConfig,
          driftDurationMinutes: newMinutes,
          driftStartTime: now,
          driftStartFreq: currentFreq
      };
      
      setSoundConfig(newConfig);
      setDriftTimeRemaining(newMinutes); 
      markCustomized();
  };
  
  const markCustomized = () => setIsCustomized(true);

  const handleLimitsChange = (min: number, max: number) => {
      setActivePattern(prev => ({ ...prev, minCycleDuration: min, maxCycleDuration: max }));
      markCustomized();
  };
  
  const handleStepChange = (stepIdx: number, newDuration: number) => {
      setActivePattern(prev => {
          const newSteps = [...prev.steps];
          if (newSteps[stepIdx]) {
              newSteps[stepIdx] = { ...newSteps[stepIdx], duration: newDuration };
          }
          return { ...prev, steps: newSteps };
      });
      markCustomized();
  };

  const handleStepTypeChange = (stepIdx: number) => {
     setActivePattern(prev => {
         const newSteps = [...prev.steps];
         const current = newSteps[stepIdx].type;
         let next = BreathPhase.INHALE;
         if (current === BreathPhase.INHALE) next = BreathPhase.HOLD;
         else if (current === BreathPhase.HOLD) next = BreathPhase.EXHALE;
         else if (current === BreathPhase.EXHALE) next = BreathPhase.INHALE;
         newSteps[stepIdx].type = next;
         return { ...prev, steps: newSteps };
     });
     markCustomized();
  };
  
  const handleAddStep = (indexToAddAfter: number) => {
      setActivePattern(prev => {
          const newSteps = [...prev.steps];
          newSteps.splice(indexToAddAfter + 1, 0, { type: BreathPhase.HOLD, duration: 2 });
          return { ...prev, steps: newSteps };
      });
      setSelectedStepIndex(indexToAddAfter + 1);
      markCustomized();
  };

  const handleRemoveStep = (indexToRemove: number) => {
      setActivePattern(prev => {
          if (prev.steps.length <= 1) return prev;
          const newSteps = prev.steps.filter((_, i) => i !== indexToRemove);
          return { ...prev, steps: newSteps };
      });
      setSelectedStepIndex(prev => Math.max(0, Math.min(prev, activePattern.steps.length - 2)));
      markCustomized();
  };
  
  useEffect(() => {
     if (!isActive) {
        const base = calculateTotalBaseDuration(activePattern);
        setCurrentCycleTotal(base);
     }
  }, [activePattern, isActive]);


  useEffect(() => {
      resetSession(patterns[0], true);
  }, []); 

  useEffect(() => {
    if (isActive) {
        stateRef.current.isActive = true;
        stateRef.current.phaseStartTime = performance.now();
        stateRef.current.lastMainTickIndex = -1;
        stateRef.current.lastSubTickIndex = -1;
        setPhaseStartTime(Date.now()); 
        requestRef.current = requestAnimationFrame(animateLoop);
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive]); 


  const animateLoop = (time: number) => {
      if (!stateRef.current.isActive) return;

      const { phaseStartTime, stepIndex, pattern, ticksPerPhase, mainTicksPerPhase, adjustmentPerCycle, soundConfig, lastStepIndex } = stateRef.current;
      
      const baseTotal = calculateTotalBaseDuration(pattern);
      const currentTotal = stateRef.current.currentCycleTotal; 
      const multiplier = currentTotal / baseTotal;

      const currentStepObj = pattern.steps[stepIndex];
      const currentDuration = Math.max(0.5, currentStepObj.duration * multiplier);
      
      stateRef.current.currentDuration = currentDuration;
      setCurrentDuration(currentDuration);

      const elapsed = (time - phaseStartTime) / 1000; 
      const timeLeft = Math.max(0, currentDuration - elapsed);
      const progress = Math.min(1, elapsed / currentDuration);
      
      // Calculate Live Volume for UI
      let calculatedVol = 0;
      if (currentStepObj.type === BreathPhase.INHALE) {
           calculatedVol = soundConfig.minVol + (soundConfig.maxVol - soundConfig.minVol) * progress;
      } else if (currentStepObj.type === BreathPhase.EXHALE) {
           calculatedVol = soundConfig.maxVol - (soundConfig.maxVol - soundConfig.minVol) * progress;
      } else {
           // Hold
           if (stateRef.current.prevPhase === BreathPhase.INHALE) calculatedVol = soundConfig.maxVol;
           else calculatedVol = soundConfig.minVol;
      }
      setLiveVolume(calculatedVol);


      if (soundMode === SoundMode.BINAURAL) {
          let currentLeft = soundConfig.binauralLeftFreq;
          let currentRight = soundConfig.binauralRightFreq;

          if (soundConfig.driftMode !== 'NONE' && soundConfig.driftStartTime && soundConfig.driftStartFreq) {
              const driftElapsedMs = Date.now() - soundConfig.driftStartTime;
              const totalDriftMs = soundConfig.driftDurationMinutes * 60 * 1000;
              const driftProgress = Math.min(1, driftElapsedMs / totalDriftMs);
              
              const minutesLeft = soundConfig.driftDurationMinutes * (1 - driftProgress);
              setDriftTimeRemaining(minutesLeft);

              const start = soundConfig.driftStartFreq;
              const diffOffset = soundConfig.driftTargetDiff || 0;
              
              let actualTarget = 0;

              if (soundConfig.driftMode === 'LEFT_TO_RIGHT') {
                  const target = soundConfig.binauralRightFreq;
                  actualTarget = start < target ? (target - diffOffset) : (target + diffOffset);
                  
                  if (start < target && actualTarget < start) actualTarget = start;
                  if (start > target && actualTarget > start) actualTarget = start;
                  
                  currentLeft = start + (actualTarget - start) * driftProgress;
              } else {
                  const target = soundConfig.binauralLeftFreq;
                  actualTarget = start < target ? (target - diffOffset) : (target + diffOffset);
                  
                  if (start < target && actualTarget < start) actualTarget = start;
                  if (start > target && actualTarget > start) actualTarget = start;

                  currentRight = start + (actualTarget - start) * driftProgress;
              }
          }
          const freqs = audioService.updateLiveParameters(
            currentLeft, 
            currentRight, 
            soundConfig.binauralMultiplier || 0,
            soundConfig.binauralDualMultiplier || 0,
            soundConfig.driftCarrierMode,
            soundConfig.dualMode
          );
          setLiveFreqs({ left: currentLeft, right: currentRight });
          if(freqs) setExtraFreqs({ carrier: freqs.carrier, dualLeft: freqs.dualLeft, dualRight: freqs.dualRight });
      }

      if (soundConfig.ticksEnabled) {
          const mainCount = mainTicksPerPhase <= 0 ? 0 : mainTicksPerPhase;
          const subCount = ticksPerPhase <= 0 ? 0 : ticksPerPhase;

          const mainInterval = mainCount > 0 ? currentDuration / mainCount : 999999;
          const subInterval = subCount > 0 ? currentDuration / subCount : 999999;

          const currentMainIndex = mainCount > 0 ? Math.floor(elapsed / mainInterval) : -1;
          const currentSubIndex = subCount > 0 ? Math.floor(elapsed / subInterval) : -1;
          
          let mainBeatTriggered = false;

          if (mainCount > 0 && currentMainIndex > stateRef.current.lastMainTickIndex && currentMainIndex < mainCount) {
              const isInhale = pattern.steps[stepIndex].type === BreathPhase.INHALE;
              const isExhale = pattern.steps[stepIndex].type === BreathPhase.EXHALE;
              const isHold = pattern.steps[stepIndex].type === BreathPhase.HOLD;

              let beatFreq = 400; // Default Exhale

              if (isInhale) {
                  beatFreq = 800;
              } else if (isExhale) {
                  beatFreq = 400;
              } else if (isHold) {
                  // Use previous phase frequency
                  if (stateRef.current.prevPhase === BreathPhase.INHALE) beatFreq = 800;
                  else beatFreq = 400;
              }

              audioService.playBeat(soundConfig.maxVol, beatFreq);
              stateRef.current.lastMainTickIndex = currentMainIndex;
              setTickTrigger(t => t + 1);
              mainBeatTriggered = true;
          }

          if (!mainBeatTriggered && subCount > 0 && currentSubIndex > stateRef.current.lastSubTickIndex && currentSubIndex < subCount) {
              audioService.playTick(soundConfig.maxVol * 0.6);
              stateRef.current.lastSubTickIndex = currentSubIndex;
              setTickTrigger(t => t + 1);
          }
      }

      // --- 5. TONE SCHEDULING (Run once per step start) ---
      if (lastStepIndex !== stepIndex) {
          stateRef.current.lastStepIndex = stepIndex;
          
          stateRef.current.lastMainTickIndex = -1;
          stateRef.current.lastSubTickIndex = -1;
          
          if (soundConfig.ticksEnabled) {
             const mainCount = mainTicksPerPhase <= 0 ? 0 : mainTicksPerPhase;
             if (mainCount > 0) {
                 const isInhale = currentStepObj.type === BreathPhase.INHALE;
                 const isHold = currentStepObj.type === BreathPhase.HOLD;
                 
                 let beatFreq = 400;
                 if (isInhale) beatFreq = 800;
                 else if (isHold) {
                      if (stateRef.current.prevPhase === BreathPhase.INHALE) beatFreq = 800;
                 }

                 audioService.playBeat(soundConfig.maxVol, beatFreq);
                 stateRef.current.lastMainTickIndex = 0;
                 setTickTrigger(t => t + 1);
             } else if (ticksPerPhase > 0) {
                 audioService.playTick(soundConfig.maxVol * 0.6);
                 stateRef.current.lastSubTickIndex = 0;
                 setTickTrigger(t => t + 1);
             }
          }

          let startFreq = 0; let endFreq = 0; let startVol = 0; let endVol = 0;

          if (currentStepObj.type === BreathPhase.INHALE) {
              startFreq = soundConfig.minFreq; endFreq = soundConfig.maxFreq;
              startVol = soundConfig.minVol; endVol = soundConfig.maxVol;
              setVolume(1.0);
          } else if (currentStepObj.type === BreathPhase.EXHALE) {
              startFreq = soundConfig.maxFreq; endFreq = soundConfig.minFreq;
              startVol = soundConfig.maxVol; endVol = soundConfig.minVol;
              setVolume(0.0);
          } else if (currentStepObj.type === BreathPhase.HOLD) {
              // FREEZE LOGIC for Audio
              const prevType = stateRef.current.prevPhase; 
              if (prevType === BreathPhase.INHALE) {
                  // Freeze at High
                  startFreq = soundConfig.maxFreq; endFreq = soundConfig.maxFreq;
                  startVol = soundConfig.maxVol; endVol = soundConfig.maxVol;
              } else {
                  // Freeze at Low
                  startFreq = soundConfig.minFreq; endFreq = soundConfig.minFreq;
                  startVol = soundConfig.minVol; endVol = soundConfig.minVol;
              }
              // Do NOT change visual volume state here, leave it as is (so BreathingCircle uses prev state)
          }

          audioService.scheduleRamp(startFreq, endFreq, startVol, endVol, Math.max(0.1, currentDuration));
      }

      // --- 6. PHASE CHANGE LOGIC ---
      if (elapsed >= currentDuration) {
          // Store prev phase before switching
          stateRef.current.prevPhase = pattern.steps[stepIndex].type;
          setPrevPhase(pattern.steps[stepIndex].type); 

          let nextIndex = (stepIndex + 1) % pattern.steps.length;
          
          if (nextIndex === 0 && adjustmentPerCycle !== 0) {
              const minL = pattern.minCycleDuration || 4;
              const maxL = pattern.maxCycleDuration || 60;
              let newTotal = currentTotal + adjustmentPerCycle;
              newTotal = Math.max(minL, Math.min(maxL, newTotal));
              stateRef.current.currentCycleTotal = newTotal;
              setCurrentCycleTotal(newTotal);
          }

          let attempts = 0;
          const nextMultiplier = stateRef.current.currentCycleTotal / baseTotal;
          while (pattern.steps[nextIndex].duration * nextMultiplier < 0.2 && attempts < pattern.steps.length) {
              nextIndex = (nextIndex + 1) % pattern.steps.length;
              attempts++;
          }

          stateRef.current.stepIndex = nextIndex;
          stateRef.current.phaseStartTime = time; 
          
          stateRef.current.lastMainTickIndex = -1;
          stateRef.current.lastSubTickIndex = -1;

          setTickTrigger(t => t + 1); 

          setStepIndex(nextIndex);
          setSecondsLeft(pattern.steps[nextIndex].duration * nextMultiplier); 
          setPhaseProgress(0);
          setPhaseStartTime(Date.now()); 
          
      } else {
          setSecondsLeft(timeLeft);
          setPhaseProgress(progress);
      }

      requestRef.current = requestAnimationFrame(animateLoop);
  };

  const toggleMode = () => {
    setSoundMode(prev => {
        if (prev === SoundMode.TONES) return SoundMode.BINAURAL;
        if (prev === SoundMode.BINAURAL) return SoundMode.SILENCE;
        return SoundMode.TONES;
    });
    markCustomized();
  };

  const toggleTicks = () => {
      setSoundConfig(prev => ({ ...prev, ticksEnabled: !prev.ticksEnabled }));
      markCustomized();
  };

  const handleToggleSettingsMode = () => {
      setSettingsMode(prev => {
          if (prev === 'DEFAULT') return 'STEPS';
          if (prev === 'STEPS') return 'SOUND';
          return 'DEFAULT';
      });
  };

  const handleRightTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isMinimalist) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    rightGestureStartY.current = clientY;
    rightGestureStartValue.current = ticksPerPhase;
    setShowTickOverlay('RIGHT');
  };

  const handleRightTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (isMinimalist) return;
    if (showTickOverlay !== 'RIGHT') return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = rightGestureStartY.current - clientY; 
    const stepChange = Math.round(deltaY / 30);
    const newValue = Math.min(Math.max(0, rightGestureStartValue.current + stepChange), 16);
    if (newValue !== ticksPerPhase) {
        setTicksPerPhase(newValue);
        markCustomized();
    }
  };

  const handleLeftTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isMinimalist) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    leftGestureStartY.current = clientY;
    leftGestureStartValue.current = mainTicksPerPhase;
    setShowTickOverlay('LEFT');
  };

  const handleLeftTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (isMinimalist) return;
    if (showTickOverlay !== 'LEFT') return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = leftGestureStartY.current - clientY; 
    const stepChange = Math.round(deltaY / 30);
    const newValue = Math.min(Math.max(0, leftGestureStartValue.current + stepChange), 8); 
    if (newValue !== mainTicksPerPhase) {
        setMainTicksPerPhase(newValue);
        markCustomized();
    }
  };

  const handleCenterTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isMinimalist) return;
    if ((e.target as HTMLElement).closest('.step-list')) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    centerGestureStartY.current = clientY;
    centerGestureStartValue.current = soundConfig.maxVol; 
    setShowTickOverlay('CENTER');
  };

  const handleCenterTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (isMinimalist) return;
    if (showTickOverlay !== 'CENTER') return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = centerGestureStartY.current - clientY; 
    const stepChange = deltaY / 200; 
    const newValue = Math.min(Math.max(0, centerGestureStartValue.current + stepChange), 1.0);
    if (Math.abs(newValue - soundConfig.maxVol) > 0.01) {
        setSoundConfig(prev => ({ ...prev, maxVol: newValue }));
        markCustomized();
    }
  };

  const handleTouchEnd = () => {
    setShowTickOverlay(null);
  };

  const currentStep = activePattern.steps[stepIndex];
  const breathIntensity = calculateIntensity();
  const timeToLimit = calculateTimeToLimit();
  
  const metronomeDuration = ticksPerPhase > 0 ? (currentDuration / ticksPerPhase) : 1;

  function calculateIntensity() {
    if (currentStep.type === BreathPhase.INHALE) return 0.2 + (phaseProgress * 0.8);
    if (currentStep.type === BreathPhase.EXHALE) return 1.0 - (phaseProgress * 0.8);
    if (currentStep.type === BreathPhase.HOLD) {
        if (prevPhase === BreathPhase.INHALE) return 1.0;
        if (prevPhase === BreathPhase.EXHALE) return 0.2;
    }
    return 0.5;
  }

  const getPhaseIcon = (phase: BreathPhase) => {
      switch(phase) {
          case BreathPhase.INHALE: 
            return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>;
          case BreathPhase.EXHALE:
            return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>;
          default:
            return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400"><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
      }
  };

  let gestureHeaderLabel = isCustomized ? "" : activePattern.name; 
  let gestureCircleValue: string | null = null;

  if (showTickOverlay === 'LEFT') {
      gestureHeaderLabel = "ОСНОВНЫЕ УДАРЫ";
      gestureCircleValue = mainTicksPerPhase.toString();
  } else if (showTickOverlay === 'RIGHT') {
      gestureHeaderLabel = "МЕТРОНОМ";
      gestureCircleValue = ticksPerPhase.toString();
  } else if (showTickOverlay === 'CENTER') {
      gestureHeaderLabel = "ГРОМКОСТЬ";
      gestureCircleValue = `${Math.round(soundConfig.maxVol * 100)}%`;
  }

  return (
    <div className="relative h-screen w-full bg-calm-bg text-calm-text flex flex-col items-center justify-between overflow-hidden">
      
      {/* Gesture Areas (Disabled in Minimalist) */}
      {!isMinimalist && (
        <>
            <div className="absolute top-20 bottom-52 right-0 w-1/5 z-40"
              onTouchStart={handleRightTouchStart} onTouchMove={handleRightTouchMove} onTouchEnd={handleTouchEnd}
              onMouseDown={handleRightTouchStart} onMouseMove={handleRightTouchMove} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd} />
            <div className="absolute top-20 bottom-52 left-0 w-1/5 z-40"
              onTouchStart={handleLeftTouchStart} onTouchMove={handleLeftTouchMove} onTouchEnd={handleTouchEnd}
              onMouseDown={handleLeftTouchStart} onMouseMove={handleLeftTouchMove} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd} />
            <div className="absolute top-24 bottom-52 left-1/5 right-1/5 z-30"
              onTouchStart={handleCenterTouchStart} onTouchMove={handleCenterTouchMove} onTouchEnd={handleTouchEnd}
              onMouseDown={handleCenterTouchStart} onMouseMove={handleCenterTouchMove} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd} />
        </>
      )}

      {/* Top Header Row (Hidden in Minimalist) */}
      {!isMinimalist && (
      <div className="absolute top-0 left-0 right-0 h-20 flex items-center justify-between px-4 z-50">
          <div className="flex gap-2 w-[120px]">
            <button onClick={() => setShowAI(true)} className="w-10 h-10 flex items-center justify-center bg-slate-800/50 backdrop-blur-md rounded-full text-indigo-400 hover:text-white hover:bg-indigo-600/50 transition-all border border-slate-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </button>
            <button onClick={toggleTicks} className={`w-10 h-10 flex items-center justify-center bg-slate-800/50 backdrop-blur-md rounded-full transition-all border border-slate-700/50 ${soundConfig.ticksEnabled ? 'text-white bg-slate-700/50' : 'text-slate-500'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M12 2l4 4M12 2l-4 4"/></svg>
            </button>
            <button onClick={toggleMode} className={`w-10 h-10 flex items-center justify-center bg-slate-800/50 backdrop-blur-md rounded-full transition-all border border-slate-700/50 ${soundMode === SoundMode.SILENCE ? 'text-slate-500' : 'text-slate-200'}`}>
                {soundMode === SoundMode.TONES && <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>}
                {soundMode === SoundMode.BINAURAL && <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="2" x2="12" y2="22"></line><path d="M22 10s-2-2-4-2-4 2-4 2"></path><path d="M2 10s2-2 4-2 4 2 4 2"></path></svg>}
                {soundMode === SoundMode.SILENCE && <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>}
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center">
             <p className="text-xl font-bold text-slate-500 uppercase tracking-widest truncate max-w-[200px] leading-none">
                 {gestureHeaderLabel}
             </p>
          </div>

          <div className="flex flex-col items-end w-[120px]"> 
               <>
                   {isActive ? (
                        <div className="text-xl font-mono font-bold text-white tracking-tighter drop-shadow-lg opacity-80 leading-none">
                            {currentCycleTotal.toFixed(1)}<span className="text-[10px] text-slate-500 ml-1 font-sans font-normal uppercase">сек</span>
                        </div>
                    ) : (
                        <div className="text-xl font-mono font-bold text-slate-600 tracking-tighter opacity-50 leading-none">
                        {calculateTotalBaseDuration(activePattern).toFixed(1)}<span className="text-[10px] ml-1 font-sans font-normal uppercase">сек</span>
                        </div>
                    )}
                    
                    {isActive && adjustmentPerCycle !== 0 && timeToLimit && (
                         <div className="mt-1">
                             <span className="text-sm font-mono font-bold text-slate-400 leading-none">{timeToLimit}</span>
                         </div>
                    )}
                </>
          </div>
      </div>
      )}

      {/* Visualizer Area */}
      <main className="flex-1 flex flex-col items-center justify-center w-full relative pointer-events-none">
         {/* Step List (Hidden in Minimalist) */}
         {!isMinimalist && (
         <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20 step-list pointer-events-auto">
             {activePattern.steps.map((s, i) => (
                 <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${stepIndex === i && isActive ? 'border-calm-accent bg-calm-accent/20 scale-110' : 'border-white/5 bg-black/20 opacity-50'}`}>
                     {getPhaseIcon(s.type)}
                     <span className="font-mono font-bold text-slate-300 text-xs">{s.duration}</span>
                 </div>
             ))}
         </div>
         )}

         <BreathingCircle 
            phase={currentStep.type}
            prevPhase={prevPhase}
            secondsLeft={secondsLeft}
            totalDurationOfPhase={currentDuration}
            isActive={isActive}
            volume={volume} 
            progress={phaseProgress} 
            tickTrigger={tickTrigger} 
            intensity={breathIntensity}
            overrideText={gestureCircleValue}
         />
         
         <div className="mt-8 h-16 flex items-center justify-center pointer-events-auto cursor-pointer" onClick={() => setIsMinimalist(!isMinimalist)}>
            {isActive && !gestureCircleValue && (
                <div className="transition-opacity duration-75" style={{ opacity: breathIntensity }}>
                    {currentStep.type === BreathPhase.INHALE && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
                    )}
                    {currentStep.type === BreathPhase.EXHALE && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
                    )}
                    {currentStep.type === BreathPhase.HOLD && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    )}
                </div>
            )}
            {/* Show description if not active (and not minimalist, or maybe keep minimalist toggle logic consistent) */}
            {!isActive && !gestureCircleValue && !isMinimalist && (
                <p className="text-sm text-slate-500 max-w-xs mx-auto text-center px-6">
                    {activePattern.description}
                </p>
            )}
            {/* Show just an icon or hint to exit minimalist if stopped? */}
            {!isActive && isMinimalist && (
                 <div className="text-slate-700 animate-pulse">
                     <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 12 16 16 12"></polyline><line x1="12" y1="8" x2="12" y2="16"></line></svg>
                 </div>
            )}
         </div>
      </main>

      {/* Controls (Hidden in Minimalist) */}
      {!isMinimalist && (
      <div className="w-full z-50 pointer-events-auto">
          <Controls 
            isActive={isActive}
            adjustment={adjustmentPerCycle}
            tickDuration={metronomeDuration}
            phaseStartTime={phaseStartTime} 
            tickTrigger={tickTrigger}
            onAdjustmentChange={(v) => { setAdjustmentPerCycle(v); markCustomized(); }}
            onToggleActive={handleToggleActive}
            settingsMode={settingsMode}
            onToggleSettingsMode={handleToggleSettingsMode}
            onOpenLibrary={() => setShowSettings(true)}
            minLimit={activePattern.minCycleDuration || 4}
            maxLimit={activePattern.maxCycleDuration || 60}
            onLimitsChange={handleLimitsChange}
            steps={activePattern.steps}
            selectedStepIndex={selectedStepIndex}
            onSelectStep={setSelectedStepIndex}
            onStepChange={handleStepChange}
            onStepTypeChange={handleStepTypeChange}
            onAddStep={handleAddStep}
            onRemoveStep={handleRemoveStep}
            soundConfig={soundConfig}
            onSoundConfigChange={setSoundConfig}
            onDriftDurationChange={handleDriftDurationChange}
            liveFreqs={liveFreqs}
            extraFreqs={extraFreqs}
            driftTimeRemaining={driftTimeRemaining}
            liveVolume={liveVolume}
            soundModeName={soundMode}
          />
      </div>
      )}

      {showSettings && (
        <SettingsModal 
          patterns={patterns}
          currentPatternId={activePattern.id}
          onSelectPattern={(p) => { setActivePattern(p); resetSession(p, true); }}
          onSavePattern={handleSavePattern}
          onSaveSessionAsNew={handleSaveSessionAsNew}
          onDeletePattern={handleDeletePattern}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAI && (
        <AIModal 
          onApplyPattern={(p) => { handleSavePattern(p); setActivePattern(p); resetSession(p, true); }}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
};

export default App;