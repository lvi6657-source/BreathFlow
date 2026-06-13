
export enum BreathPhase {
  INHALE = 'Вдох',
  HOLD = 'Пауза',
  EXHALE = 'Выдох',
}

export enum SoundMode {
    TONES = 'Частоты',
    BINAURAL = 'Бинауральный',
    SILENCE = 'Тишина'
}

export interface BreathingStep {
  type: BreathPhase;
  duration: number;
}

export interface BreathingPattern {
  id: string;
  name: string;
  description: string;
  steps: BreathingStep[];
  adjustmentPerCycle: number; // Seconds to add/remove per cycle
  minCycleDuration: number;   // Limit for speeding up
  maxCycleDuration: number;   // Limit for slowing down
}

export interface SoundConfig {
    // Tones Mode
    minFreq: number; 
    maxFreq: number;
    
    // Binaural Mode
    binauralLeftFreq: number;
    binauralRightFreq: number;
    binauralMultiplier: number; // Center Carrier: -5 to 5, 0 is off
    binauralDualMultiplier: number; // L/R Duplicates: -5 to 5, 0 is off

    // Binaural Drift Logic
    driftMode: 'NONE' | 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
    driftCarrierMode: 'HARMONIC' | 'DIFFERENCE'; // 'HARMONIC' = standard (avg * 2^x), 'DIFFERENCE' = (diff * x) & preserved beat
    dualMode: 'HARMONIC' | 'DIFFERENCE'; // Independent mode for Dual sliders
    driftDurationMinutes: number;
    driftTargetDiff: number; // Minimum difference in Hz to maintain/reach
    driftStartTime: number | null; // Timestamp when drift started
    driftStartFreq: number | null; // Frequency at start of drift

    // Common Volume
    minVol: number;  
    maxVol: number; 
    
    // Ticks
    ticksEnabled: boolean;

    isEnabled: boolean;
}

export interface AIPatternResponse {
  patternName: string;
  reasoning: string;
  inhaleSeconds: number;
  holdInSeconds: number;
  exhaleSeconds: number;
  holdOutSeconds: number;
}

export const PRESETS: BreathingPattern[] = [
  {
    id: 'preset-1',
    name: "Равномерное",
    description: "Баланс и спокойствие",
    steps: [
      { type: BreathPhase.INHALE, duration: 4 },
      { type: BreathPhase.EXHALE, duration: 4 }
    ],
    adjustmentPerCycle: 0,
    minCycleDuration: 4,
    maxCycleDuration: 60
  },
  {
    id: 'preset-2',
    name: "4-7-8",
    description: "Глубокое расслабление",
    steps: [
      { type: BreathPhase.INHALE, duration: 4 },
      { type: BreathPhase.HOLD, duration: 7 },
      { type: BreathPhase.EXHALE, duration: 8 }
    ],
    adjustmentPerCycle: 0,
    minCycleDuration: 10,
    maxCycleDuration: 60
  },
  {
    id: 'preset-3',
    name: "Коробка",
    description: "Концентрация",
    steps: [
      { type: BreathPhase.INHALE, duration: 4 },
      { type: BreathPhase.HOLD, duration: 4 },
      { type: BreathPhase.EXHALE, duration: 4 },
      { type: BreathPhase.HOLD, duration: 4 }
    ],
    adjustmentPerCycle: 0,
    minCycleDuration: 8,
    maxCycleDuration: 60
  }
];