export interface TimerSettings {
  focusMinutes: number;
  keepScreenAwake: boolean;
  longBreakEvery: number;
  longBreakMinutes: number;
  shortBreakMinutes: number;
  systemNotificationsEnabled: boolean;
  timerAutoAdvance: boolean;
  timerOpenFocusOnStart: boolean;
  timerSoundEnabled: boolean;
  timerSoundType: "SOFT_BELL" | "WOOD" | "DIGITAL" | "NONE";
  timerTickEnabled: boolean;
  timerVibrationEnabled: boolean;
  timerVolume: number;
  timezone: string;
}

// Same defaults as PlannerPreferences; reading an unused timer does not need
// to provision a row. Shared with the tools UI's initial state.
export const defaultTimerSettings: Readonly<TimerSettings> = Object.freeze({
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  timerSoundEnabled: true,
  systemNotificationsEnabled: false,
  timerSoundType: "SOFT_BELL",
  timerVolume: 70,
  timerTickEnabled: false,
  timerVibrationEnabled: true,
  timerAutoAdvance: false,
  timerOpenFocusOnStart: false,
  keepScreenAwake: true,
  timezone: "America/Sao_Paulo",
});
