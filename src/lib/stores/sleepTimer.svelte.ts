import { getPlayer } from './player.svelte';

interface TimerState {
  minutesLeft: number;
  totalMinutes: number;
  isActive: boolean;
  endTime: number | null;
  isFading: boolean;
}

let timerState = $state<TimerState>({
  minutesLeft: 0,
  totalMinutes: 0,
  isActive: false,
  endTime: null,
  isFading: false,
});

let intervalId: number | null = null;
let originalVolume: number | null = null;
let audioElement: HTMLAudioElement | null = null;

export function getSleepTimer() {
  return {
    get minutesLeft() { return timerState.minutesLeft; },
    get totalMinutes() { return timerState.totalMinutes; },
    get isActive() { return timerState.isActive; },
    get endTime() { return timerState.endTime; },
    get isFading() { return timerState.isFading; },
    get progress() {
      if (!timerState.isActive || timerState.totalMinutes === 0) return 0;
      return (timerState.totalMinutes - timerState.minutesLeft) / timerState.totalMinutes;
    },
  };
}

function getAudioElement(): HTMLAudioElement | null {
  if (!audioElement) {
    audioElement = document.querySelector('audio');
  }
  return audioElement;
}

export function startSleepTimer(minutes: number) {
  // Clear existing timer
  stopSleepTimer();
  
  const endTime = Date.now() + minutes * 60 * 1000;
  
  // Save original volume
  const audio = getAudioElement();
  if (audio) {
    originalVolume = audio.volume;
  }
  
  timerState = {
    minutesLeft: minutes,
    totalMinutes: minutes,
    isActive: true,
    endTime,
    isFading: false,
  };
  
  // Update every 5 seconds for smooth countdown
  intervalId = window.setInterval(() => {
    const now = Date.now();
    const remainingMs = endTime - now;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    
    // Start fade out in the last 30 seconds
    if (remainingMs <= 30000 && remainingMs > 0) {
      timerState.isFading = true;
      const audio = getAudioElement();
      if (audio && originalVolume !== null) {
        // Gradually reduce volume based on remaining time
        const fadeProgress = remainingMs / 30000;
        audio.volume = originalVolume * fadeProgress;
      }
    }
    
    if (remainingMinutes <= 0) {
      timerState.minutesLeft = 0;
      stopSleepTimer();
      // Pause playback
      const audio = getAudioElement();
      if (audio) {
        audio.pause();
      }
    } else {
      timerState.minutesLeft = remainingMinutes;
    }
  }, 5000);
  
  console.log(`[SleepTimer] Started: ${minutes} minutes`);
}

export function stopSleepTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  // Restore original volume
  const audio = getAudioElement();
  if (audio && originalVolume !== null) {
    audio.volume = originalVolume;
  }
  
  timerState = {
    minutesLeft: 0,
    totalMinutes: 0,
    isActive: false,
    endTime: null,
    isFading: false,
  };
  
  originalVolume = null;
  
  console.log('[SleepTimer] Stopped');
}

export function extendSleepTimer(additionalMinutes: number) {
  if (!timerState.isActive) return;
  
  const currentEndTime = timerState.endTime || Date.now();
  const newEndTime = currentEndTime + additionalMinutes * 60 * 1000;
  const newTotalMinutes = Math.ceil((newEndTime - Date.now()) / 60000);
  
  // Restore volume if extending
  const audio = getAudioElement();
  if (audio && originalVolume !== null) {
    audio.volume = originalVolume;
  }
  
  timerState = {
    ...timerState,
    minutesLeft: newTotalMinutes,
    totalMinutes: newTotalMinutes,
    endTime: newEndTime,
    isFading: false,
  };
  
  console.log(`[SleepTimer] Extended by ${additionalMinutes} minutes`);
}
