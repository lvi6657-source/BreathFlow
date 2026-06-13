import { SoundMode } from "../types";

class AudioService {
  private audioContext: AudioContext | null = null;
  
  // TONES Nodes
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  // BINAURAL Nodes (Main)
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private leftPan: StereoPannerNode | null = null;
  private rightPan: StereoPannerNode | null = null;
  
  // Carrier Node (Center Multiplier)
  private carrierOsc: OscillatorNode | null = null;
  private carrierGain: GainNode | null = null;

  // Dual Nodes (L/R Multiplier)
  private leftSubOsc: OscillatorNode | null = null;
  private rightSubOsc: OscillatorNode | null = null;
  private leftSubPan: StereoPannerNode | null = null;
  private rightSubPan: StereoPannerNode | null = null;
  private dualGain: GainNode | null = null; // To mute/unmute duals independently

  private masterGain: GainNode | null = null; // Controls volume for all binaural including carrier and duals

  private mode: SoundMode = SoundMode.SILENCE;
  
  private init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    // FORCE STEREO: Critical for mobile devices to hear binaural beats
    this.audioContext.destination.channelCount = 2;
    this.audioContext.destination.channelCountMode = 'explicit';
    this.audioContext.destination.channelInterpretation = 'speakers';
  }

  public setMode(mode: SoundMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.stopAllContinuous();
  }

  private stopAllContinuous() {
      if (this.audioContext) {
          const now = this.audioContext.currentTime;
          // Fade out Tones
          if (this.gain) {
              this.gain.gain.cancelScheduledValues(now);
              this.gain.gain.setTargetAtTime(0, now, 0.05);
          }
          // Fade out Binaural Master
          if (this.masterGain) {
              this.masterGain.gain.cancelScheduledValues(now);
              this.masterGain.gain.setTargetAtTime(0, now, 0.05);
          }
      }
      
      // Cleanup nodes after short delay
      setTimeout(() => {
        if (this.mode !== SoundMode.TONES) {
             this.osc?.disconnect(); this.osc = null;
             this.gain?.disconnect(); this.gain = null;
        }
        if (this.mode !== SoundMode.BINAURAL) {
             this.leftOsc?.disconnect(); this.leftOsc = null;
             this.rightOsc?.disconnect(); this.rightOsc = null;
             
             this.carrierOsc?.disconnect(); this.carrierOsc = null;
             this.carrierGain?.disconnect(); this.carrierGain = null;

             this.leftSubOsc?.disconnect(); this.leftSubOsc = null;
             this.rightSubOsc?.disconnect(); this.rightSubOsc = null;
             this.leftSubPan?.disconnect(); this.leftSubPan = null;
             this.rightSubPan?.disconnect(); this.rightSubPan = null;
             this.dualGain?.disconnect(); this.dualGain = null;

             this.masterGain?.disconnect(); this.masterGain = null;
             this.leftPan?.disconnect(); this.leftPan = null;
             this.rightPan?.disconnect(); this.rightPan = null;
        }
      }, 100);
  }

  public playTick(volume: number = 0.5) {
    this.init();
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = 1000;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.05 * volume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.05);
  }

  public playBeat(volume: number = 0.5, frequency: number = 400) {
    this.init();
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = frequency; 
    osc.type = 'triangle';
    
    gain.gain.setValueAtTime(0.2 * volume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.1);
  }

  // Live Update for Sliders & Drift & Multipliers
  public updateLiveParameters(
      freqLeft: number, 
      freqRight: number, 
      carrierMultiplier: number, 
      dualMultiplier: number,
      carrierMode: 'HARMONIC' | 'DIFFERENCE' = 'HARMONIC',
      dualMode: 'HARMONIC' | 'DIFFERENCE' = 'HARMONIC'
  ) {
      if (!this.audioContext) return;
      const now = this.audioContext.currentTime;
      const rampTime = 0.02; // 20ms smoothing

      // Calculate Real Targets based on Mode
      let carrierFreq = 0;
      let dualLeftFreq = 0;
      let dualRightFreq = 0;

      // 1. Calculate Carrier
      if (carrierMode === 'HARMONIC') {
          // Standard Logic
          const center = (freqLeft + freqRight) / 2;
          carrierFreq = center * Math.pow(2, carrierMultiplier);
      } else {
          // Difference Logic
          const diff = Math.abs(freqRight - freqLeft);
          carrierFreq = diff * Math.pow(2, carrierMultiplier - 1);
      }
      if (carrierFreq < 0) carrierFreq = 0;

      // 2. Calculate Duals
      if (dualMode === 'HARMONIC') {
          dualLeftFreq = freqLeft * Math.pow(2, dualMultiplier);
          dualRightFreq = freqRight * Math.pow(2, dualMultiplier);
      } else {
          // Difference Logic for Duals:
          // Shift left by octave (multiplier), but Keep the beat difference (Right = NewLeft + Diff)
          dualLeftFreq = freqLeft * Math.pow(2, dualMultiplier);
          const originalDiff = freqRight - freqLeft; 
          dualRightFreq = dualLeftFreq + originalDiff;
      }
      
      if (this.mode === SoundMode.TONES && this.osc) {
          this.osc.frequency.linearRampToValueAtTime(freqLeft, now + rampTime);
      }
      
      if (this.mode === SoundMode.BINAURAL) {
          if (this.leftOsc && this.rightOsc) {
              this.leftOsc.frequency.linearRampToValueAtTime(freqLeft, now + rampTime);
              this.rightOsc.frequency.linearRampToValueAtTime(freqRight, now + rampTime);
          }

          // 1. Update Center Carrier
          if (this.carrierOsc && this.carrierGain) {
              if (carrierMultiplier === 0) {
                  this.carrierGain.gain.setTargetAtTime(0, now, 0.05);
              } else {
                  this.carrierOsc.frequency.linearRampToValueAtTime(carrierFreq, now + rampTime);
                  if (this.carrierGain.gain.value < 0.01) {
                      this.carrierGain.gain.setTargetAtTime(0.5, now, 0.1);
                  }
              }
          }

          // 2. Update Dual Sub-Oscillators
          if (this.leftSubOsc && this.rightSubOsc && this.dualGain) {
              if (dualMultiplier === 0) {
                  this.dualGain.gain.setTargetAtTime(0, now, 0.05);
              } else {
                  this.leftSubOsc.frequency.linearRampToValueAtTime(dualLeftFreq, now + rampTime);
                  this.rightSubOsc.frequency.linearRampToValueAtTime(dualRightFreq, now + rampTime);

                  if (this.dualGain.gain.value < 0.01) {
                      this.dualGain.gain.setTargetAtTime(0.5, now, 0.1);
                  }
              }
          }
      }
      
      return {
          carrier: carrierFreq,
          dualLeft: dualLeftFreq,
          dualRight: dualRightFreq
      };
  }

  public scheduleRamp(startFreq: number, endFreq: number, startVol: number, endVol: number, duration: number) {
    this.init();
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    // --- TONES MODE ---
    if (this.mode === SoundMode.TONES) {
        if (!this.osc || !this.gain) {
            this.osc = this.audioContext.createOscillator();
            this.gain = this.audioContext.createGain();
            this.osc.type = 'sine';
            this.osc.connect(this.gain);
            this.gain.connect(this.audioContext.destination);
            this.osc.start();
            this.gain.gain.setValueAtTime(0, now);
        }

        // Frequency Ramp
        this.osc.frequency.cancelScheduledValues(now);
        this.osc.frequency.setValueAtTime(startFreq, now);
        this.osc.frequency.linearRampToValueAtTime(endFreq, now + duration);

        // Volume Ramp
        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(startVol, now);
        this.gain.gain.linearRampToValueAtTime(endVol, now + duration);
    }

    // --- BINAURAL MODE ---
    else if (this.mode === SoundMode.BINAURAL) {
         if (!this.leftOsc || !this.rightOsc || !this.masterGain) {
             this.masterGain = this.audioContext.createGain();
             this.masterGain.connect(this.audioContext.destination);
             
             // --- Main Left Channel ---
             this.leftOsc = this.audioContext.createOscillator();
             this.leftOsc.type = 'sine';
             this.leftPan = this.audioContext.createStereoPanner();
             this.leftPan.pan.value = -1; // Full Left
             this.leftOsc.connect(this.leftPan);
             this.leftPan.connect(this.masterGain);

             // --- Main Right Channel ---
             this.rightOsc = this.audioContext.createOscillator();
             this.rightOsc.type = 'sine';
             this.rightPan = this.audioContext.createStereoPanner();
             this.rightPan.pan.value = 1; // Full Right
             this.rightOsc.connect(this.rightPan);
             this.rightPan.connect(this.masterGain);
             
             // --- Carrier Setup (Center Multiplier) ---
             this.carrierOsc = this.audioContext.createOscillator();
             this.carrierOsc.type = 'sine';
             this.carrierGain = this.audioContext.createGain();
             this.carrierGain.gain.value = 0; // Default off
             this.carrierOsc.connect(this.carrierGain);
             this.carrierGain.connect(this.masterGain);

             // --- Dual Setup (L/R Multiplier) ---
             this.dualGain = this.audioContext.createGain();
             this.dualGain.gain.value = 0; // Default off
             this.dualGain.connect(this.masterGain);

             // Left Sub
             this.leftSubOsc = this.audioContext.createOscillator();
             this.leftSubOsc.type = 'sine';
             this.leftSubPan = this.audioContext.createStereoPanner();
             this.leftSubPan.pan.value = -1; // Pan Left
             this.leftSubOsc.connect(this.leftSubPan);
             this.leftSubPan.connect(this.dualGain);

             // Right Sub
             this.rightSubOsc = this.audioContext.createOscillator();
             this.rightSubOsc.type = 'sine';
             this.rightSubPan = this.audioContext.createStereoPanner();
             this.rightSubPan.pan.value = 1; // Pan Right
             this.rightSubOsc.connect(this.rightSubPan);
             this.rightSubPan.connect(this.dualGain);

             // Start All
             this.leftOsc.start();
             this.rightOsc.start();
             this.carrierOsc.start();
             this.leftSubOsc.start();
             this.rightSubOsc.start();
         }
         
         // Master Volume Ramp (applies to ALL binaural layers)
         this.masterGain.gain.cancelScheduledValues(now);
         this.masterGain.gain.setValueAtTime(startVol, now);
         this.masterGain.gain.linearRampToValueAtTime(endVol, now + duration);
    }
  }

  public stopTone() {
      this.stopAllContinuous();
  }
}

export const audioService = new AudioService();