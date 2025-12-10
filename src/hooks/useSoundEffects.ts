import { useEffect, useRef, useCallback } from 'react';

export const useSoundEffects = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Audio Buffers for MP3s
  const buffersRef = useRef<{ [key: string]: AudioBuffer | null }>({
    charge: null,
    throw: null,
    land: null
  });
  
  // Active Source Nodes for MP3s
  const chargeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const chargeGainRef = useRef<GainNode | null>(null);

  // Initialize AudioContext
  useEffect(() => {
    const initAudio = () => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContext();
            loadSounds();
        }
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };
    
    const loadSounds = async () => {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;

        const loadBuffer = async (url: string): Promise<AudioBuffer | null> => {
            try {
                const response = await fetch(url);
                if (!response.ok) return null;
                const arrayBuffer = await response.arrayBuffer();
                return await ctx.decodeAudioData(arrayBuffer);
            } catch (e) {
                console.log(`Failed to load sound: ${url}`);
                return null;
            }
        };

        buffersRef.current.charge = await loadBuffer('/sounds/studiam.mp3');
        buffersRef.current.throw = await loadBuffer('/sounds/voice.mp3');
        buffersRef.current.land = await loadBuffer('/sounds/land.mp3');
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    
    return () => {
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
        audioContextRef.current?.close();
    };
  }, []);

  // --- Power Tone (Charge) ---
  const playPowerTone = useCallback((powerLevel: number) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;

    // Threshold check
    if (powerLevel < 0.05) {
        // Stop MP3
        if (chargeGainRef.current) {
            chargeGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        }
        return;
    }

    // Use MP3 if available
    if (buffersRef.current.charge) {
        if (!chargeSourceRef.current) {
            const src = ctx.createBufferSource();
            src.buffer = buffersRef.current.charge;
            src.loop = true;
            
            const gain = ctx.createGain();
            gain.gain.value = 0;

            src.connect(gain);
            gain.connect(ctx.destination);
            src.start();

            chargeSourceRef.current = src;
            chargeGainRef.current = gain;
        }

        // Modulate MP3
        // Pitch: 0.8x -> 1.5x
        const playbackRate = 0.8 + (powerLevel * 0.7);
        chargeSourceRef.current.playbackRate.setTargetAtTime(playbackRate, ctx.currentTime, 0.1);
        
        // Volume: 0.2 -> 0.8
        const vol = 0.2 + (powerLevel * 0.6);
        chargeGainRef.current!.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
    }
  }, []);

  const stopPowerTone = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;

    // Stop MP3
    if (chargeSourceRef.current && chargeGainRef.current) {
        chargeGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        setTimeout(() => {
            if (chargeSourceRef.current) {
                chargeSourceRef.current.stop();
                chargeSourceRef.current.disconnect();
                chargeSourceRef.current = null;
            }
            if (chargeGainRef.current) {
                chargeGainRef.current.disconnect();
                chargeGainRef.current = null;
            }
        }, 250);
    }
  }, []);

  // --- Throw Sound ---
  const playThrowSound = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;

    if (buffersRef.current.throw) {
        // Use MP3
        const src = ctx.createBufferSource();
        src.buffer = buffersRef.current.throw;
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
    }
  }, []);

  const playLandSound = useCallback(() => {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;
      
      if (buffersRef.current.land) {
          // Use MP3
          const src = ctx.createBufferSource();
          src.buffer = buffersRef.current.land;
          const gain = ctx.createGain();
          gain.gain.value = 1.0;
          
          src.connect(gain);
          gain.connect(ctx.destination);
          src.start();
      }
  }, []);

  return { playPowerTone, stopPowerTone, playThrowSound, playLandSound };
};
