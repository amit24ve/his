/**
 * Sound utility functions for playing notification sounds
 */

/**
 * Play a beep sound using Web Audio API
 * @param {number} frequency - Frequency of the beep in Hz (default: 800)
 * @param {number} duration - Duration of the beep in milliseconds (default: 200)
 * @param {number} volume - Volume of the beep (0-1, default: 0.1)
 */
export const playBeep = (frequency = 800, duration = 200, volume = 0.1) => {
  try {
    // Check if Web Audio API is supported
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume audio context if suspended (required for user interaction)
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          createBeepSound(audioContext, frequency, duration, volume);
        }).catch(() => {
          playBeepFallback();
        });
      } else {
        createBeepSound(audioContext, frequency, duration, volume);
      }
      
      return true;
    } else {
      // Fallback to HTML5 audio with data URI
      playBeepFallback();
      return true;
    }
  } catch (error) {
    console.error('Error playing beep sound:', error);
    // Try fallback method
    playBeepFallback();
    return false;
  }
};

/**
 * Create and play beep sound with Web Audio API
 */
const createBeepSound = (audioContext, frequency, duration, volume) => {
  try {
    // Create oscillator for the beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure the beep
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'sine';
    
    // Set volume with fade in/out to avoid clicks
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);
    
    // Start and stop the oscillator
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (error) {
    console.error('Error creating beep sound:', error);
    playBeepFallback();
  }
};

/**
 * Fallback beep sound using HTML5 audio with data URI
 */
const playBeepFallback = () => {
  try {
    // Create a simple beep sound using data URI
    const audio = new Audio();
    audio.volume = 0.1;
    
    // Simple beep sound data URI (short sine wave)
    const beepDataUri = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVApHn+P';
    audio.src = beepDataUri;
    audio.play().catch(e => {
      console.warn('Could not play beep sound:', e);
    });
  } catch (error) {
    console.error('Error playing fallback beep:', error);
  }
};

/**
 * Play multiple beeps in sequence
 * @param {number} count - Number of beeps to play
 * @param {number} interval - Interval between beeps in milliseconds
 * @param {number} frequency - Frequency of each beep
 * @param {number} duration - Duration of each beep
 * @param {number} volume - Volume of each beep
 */
export const playMultipleBeeps = (count = 3, interval = 300, frequency = 800, duration = 200, volume = 0.1) => {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      playBeep(frequency, duration, volume);
    }, i * interval);
  }
};

/**
 * Global audio context for reuse
 */
let globalAudioContext = null;

/**
 * Initialize global audio context on user interaction
 */
const initGlobalAudioContext = async () => {
  try {
    if (!globalAudioContext && (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined')) {
      globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      if (globalAudioContext.state === 'suspended') {
        await globalAudioContext.resume();
      }
    }
    return globalAudioContext;
  } catch (error) {
    return null;
  }
};

/**
 * Play a notification sound (2-second beep)
 * Debugging version to identify sound issues
 */
export const playNotificationSound = async () => {
  console.log('🔊 playNotificationSound called');
  let soundPlayed = false;
  
  // Method 1: Try global audio context first
  try {
    console.log('🎵 Trying Method 1: Global audio context');
    const audioContext = await initGlobalAudioContext();
    console.log('🎵 Global audio context:', audioContext?.state);
    
    if (audioContext && audioContext.state === 'running') {
      console.log('🎵 Creating oscillator with global context');
      // Create oscillator for 2-second beep
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure the beep
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      // Set volume with fade in/out to avoid clicks
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 2);
      
      // Start and stop the oscillator (2 seconds)
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 2);
      
      console.log('✅ Method 1: Sound played with global context');
      soundPlayed = true;
    }
  } catch (error) {
    console.log('❌ Method 1 failed:', error.message);
  }
  
  // Method 2: Create fresh Web Audio API context if global failed
  if (!soundPlayed) {
    try {
      console.log('🎵 Trying Method 2: Fresh audio context');
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('🎵 Fresh audio context state:', audioContext.state);
        
        if (audioContext.state === 'suspended') {
          console.log('🎵 Resuming suspended audio context');
          await audioContext.resume();
          console.log('🎵 Audio context resumed, new state:', audioContext.state);
        }
        
        // Create oscillator for 2-second beep
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Configure the beep
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.type = 'sine';
        
        // Set volume with fade in/out to avoid clicks
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 2);
        
        // Start and stop the oscillator (2 seconds)
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 2);
        
        console.log('✅ Method 2: Sound played with fresh context');
        soundPlayed = true;
        
        // Clean up context after use
        setTimeout(() => {
          audioContext.close().catch(() => {});
        }, 2500);
      }
    } catch (error) {
      console.log('❌ Method 2 failed:', error.message);
    }
  }
  
  // Method 3: HTML5 Audio fallback
  if (!soundPlayed) {
    try {
      console.log('🎵 Trying Method 3: HTML5 Audio');
      const audio = new Audio();
      audio.volume = 0.5;
      
      // Create a data URI for a beep sound
      const beepFreq = 800;
      const beepDuration = 2;
      const sampleRate = 8000;
      const samples = sampleRate * beepDuration;
      
      // Generate simple sine wave
      let wave = '';
      for (let i = 0; i < samples; i++) {
        const sample = Math.sin((2 * Math.PI * beepFreq * i) / sampleRate);
        const scaled = Math.floor(sample * 127) + 128;
        wave += String.fromCharCode(scaled);
      }
      
      // Create data URI
      audio.src = 'data:audio/wav;base64,' + btoa(wave);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log('✅ Method 3: Sound played with HTML5 Audio');
        soundPlayed = true;
        
        // Stop after 2 seconds
        setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, 2000);
      }
    } catch (error) {
      console.log('❌ Method 3 failed:', error.message);
    }
  }
  
  // Method 4: Simple beep using existing function
  if (!soundPlayed) {
    try {
      playBeep(800, 2000, 0.3);
      soundPlayed = true;
    } catch (error) {
      // Silent fail
    }
  }
};

/**
 * HTML5 Audio fallback for notification sound
 */
const playNotificationSoundHTML5 = () => {
  return new Promise((resolve, reject) => {
    try {
      // Create audio element for a 2-second beep
      const audio = new Audio();
      audio.volume = 0.3;
      audio.preload = 'auto';
      
      // Generate a longer beep sound data URI (2 seconds)
      const sampleRate = 22050;
      const duration = 2; // 2 seconds
      const frequency = 800; // 800 Hz
      const samples = sampleRate * duration;
      const wave = new Array(samples);
      
      // Generate sine wave for 2 seconds
      for (let i = 0; i < samples; i++) {
        const time = i / sampleRate;
        const amplitude = Math.sin(2 * Math.PI * frequency * time) * 0.3;
        wave[i] = Math.floor(amplitude * 32767);
      }
      
      // Convert to base64 (simplified - using data URI for beep)
      const beepDataUri = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+Puz2UcBzOL0fLNeSsFJHfH8N2QQAoUXrTp66hVFApHn+P';
      
      audio.src = beepDataUri;
      audio.currentTime = 0;
      
      audio.onended = () => {
        console.log('HTML5 audio beep completed');
        resolve(true);
      };
      
      audio.onerror = (error) => {
        console.error('HTML5 audio error:', error);
        reject(error);
      };
      
      // Play the audio
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('HTML5 audio started successfully');
            // Stop after 2 seconds
            setTimeout(() => {
              audio.pause();
              audio.currentTime = 0;
              resolve(true);
            }, 2000);
          })
          .catch(reject);
      } else {
        // Older browsers
        setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
          resolve(true);
        }, 2000);
      }
      
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Initialize audio context on first user interaction
 * Clean version without debug logs
 */
export const initializeAudio = () => {
  const enableAudio = async () => {
    try {
      // Initialize global audio context
      await initGlobalAudioContext();
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      
      // Test play a very short, quiet sound to unlock audio
      if (globalAudioContext && globalAudioContext.state === 'running') {
        const oscillator = globalAudioContext.createOscillator();
        const gainNode = globalAudioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(globalAudioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, globalAudioContext.currentTime);
        gainNode.gain.setValueAtTime(0.001, globalAudioContext.currentTime); // Very quiet
        
        oscillator.start(globalAudioContext.currentTime);
        oscillator.stop(globalAudioContext.currentTime + 0.1); // Very short
      }
      
      // Remove event listeners after first successful interaction
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      document.removeEventListener('mousedown', enableAudio);
      
    } catch (error) {
      // Silent fail
    }
  };

  // Add event listeners for user interaction
  document.addEventListener('click', enableAudio, { once: true });
  document.addEventListener('touchstart', enableAudio, { once: true });
  document.addEventListener('keydown', enableAudio, { once: true });
  document.addEventListener('mousedown', enableAudio, { once: true });
};