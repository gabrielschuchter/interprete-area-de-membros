interface TimerSoundSettings {
  readonly timerSoundEnabled: boolean;
  readonly timerSoundType: "SOFT_BELL" | "WOOD" | "DIGITAL" | "NONE";
  readonly timerVolume: number;
}

const waveformForSound = (soundType: TimerSoundSettings["timerSoundType"]) => {
  switch (soundType) {
    case "WOOD":
      return "triangle";
    case "DIGITAL":
      return "square";
    default:
      return "sine";
  }
};

const completionFrequencyForSound = (
  soundType: TimerSoundSettings["timerSoundType"]
) => {
  switch (soundType) {
    case "WOOD":
      return 420;
    case "DIGITAL":
      return 990;
    default:
      return 740;
  }
};

let audioContext: AudioContext | null = null;
let completionAlarmInterval: number | null = null;
let completionAlarmTimeout: number | null = null;
let titleAlertInterval: number | null = null;
let titleAlertTimeout: number | null = null;
let originalTitle: string | null = null;
let titleVisibilityHandler: (() => void) | null = null;

const contextForTimer = () => {
  if (typeof window === "undefined" || !("AudioContext" in window)) {
    return null;
  }
  audioContext ??= new window.AudioContext();
  return audioContext;
};

export const unlockTimerAudio = () => {
  const context = contextForTimer();
  if (context?.state === "suspended") {
    return context.resume().catch(() => undefined);
  }
  return Promise.resolve();
};

const playTone = (
  settings: TimerSoundSettings,
  options: {
    readonly frequency: number;
    readonly durationSeconds: number;
    readonly tick?: boolean;
  }
) => {
  if (
    !settings.timerSoundEnabled ||
    settings.timerSoundType === "NONE" ||
    settings.timerVolume <= 0
  ) {
    return;
  }
  const context = contextForTimer();
  if (!context || context.state !== "running") {
    return;
  }
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const waveform = waveformForSound(settings.timerSoundType);
    const volume = (settings.timerVolume / 100) * (options.tick ? 0.025 : 0.16);
    const endAt = context.currentTime + options.durationSeconds;
    oscillator.type = waveform;
    oscillator.frequency.value = options.frequency;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, volume),
      context.currentTime + (options.tick ? 0.003 : 0.04)
    );
    gain.gain.exponentialRampToValueAtTime(0.001, endAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(endAt + 0.01);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {
    // Audio is optional and can be unavailable when the device is muted or locked.
  }
};

export const playTimerCompletionSound = (settings: TimerSoundSettings) => {
  if (!settings.timerSoundEnabled || settings.timerSoundType === "NONE") {
    return;
  }
  const frequency = completionFrequencyForSound(settings.timerSoundType);
  playTone(settings, { frequency, durationSeconds: 0.52 });
  if (settings.timerSoundType === "SOFT_BELL") {
    window.setTimeout(
      () => playTone(settings, { frequency: 990, durationSeconds: 0.42 }),
      110
    );
  }
};

export const stopTimerCompletionAlarm = () => {
  if (completionAlarmInterval !== null) {
    window.clearInterval(completionAlarmInterval);
    completionAlarmInterval = null;
  }
  if (completionAlarmTimeout !== null) {
    window.clearTimeout(completionAlarmTimeout);
    completionAlarmTimeout = null;
  }
};

export const playTimerCompletionAlarm = (settings: TimerSoundSettings) => {
  stopTimerCompletionAlarm();
  if (
    !settings.timerSoundEnabled ||
    settings.timerSoundType === "NONE" ||
    settings.timerVolume <= 0
  ) {
    return;
  }
  let plays = 0;
  const play = () => {
    playTimerCompletionSound(settings);
    plays += 1;
  };
  play();
  completionAlarmInterval = window.setInterval(() => {
    if (plays >= 4) {
      stopTimerCompletionAlarm();
      return;
    }
    play();
  }, 5000);
  completionAlarmTimeout = window.setTimeout(stopTimerCompletionAlarm, 20_000);
};

export const stopTimerTitleAlert = () => {
  if (titleAlertInterval !== null) {
    window.clearInterval(titleAlertInterval);
    titleAlertInterval = null;
  }
  if (titleAlertTimeout !== null) {
    window.clearTimeout(titleAlertTimeout);
    titleAlertTimeout = null;
  }
  if (titleVisibilityHandler) {
    document.removeEventListener("visibilitychange", titleVisibilityHandler);
    titleVisibilityHandler = null;
  }
  if (originalTitle !== null && document.title.startsWith("⏰ ")) {
    document.title = originalTitle;
  }
  originalTitle = null;
};

export const startTimerTitleAlert = () => {
  if (
    typeof document === "undefined" ||
    document.visibilityState !== "hidden"
  ) {
    return;
  }
  stopTimerTitleAlert();
  originalTitle = document.title;
  let showingAlert = true;
  const alertTitle = "⏰ Foco concluído · Interprete.";
  titleAlertInterval = window.setInterval(() => {
    showingAlert = !showingAlert;
    document.title = showingAlert ? alertTitle : (originalTitle ?? alertTitle);
  }, 750);
  titleAlertTimeout = window.setTimeout(stopTimerTitleAlert, 20_000);
  titleVisibilityHandler = () => {
    if (document.visibilityState === "visible") {
      stopTimerTitleAlert();
    }
  };
  document.addEventListener("visibilitychange", titleVisibilityHandler);
};

export const playTimerTick = (settings: TimerSoundSettings) => {
  playTone(settings, {
    frequency: settings.timerSoundType === "DIGITAL" ? 1250 : 880,
    durationSeconds: 0.035,
    tick: true,
  });
};
