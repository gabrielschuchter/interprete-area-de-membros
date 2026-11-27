"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { cn } from "@repo/design-system/lib/utils";
import { PlayIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { showTimerNotification } from "@/components/focus-timer-audio";
import {
  defaultTimerSettings,
  type TimerSettings,
} from "@/lib/focus-timer-settings";

type TimerExperience = "POMODORO" | "STOPWATCH" | "COUNTDOWN";
type NotificationState = NotificationPermission | "unsupported";

const SOUND_OPTIONS = [
  ["SOFT_BELL", "Sino suave"],
  ["WOOD", "Madeira"],
  ["DIGITAL", "Digital"],
  ["NONE", "Sem som"],
] as const;

const SectionTitle = ({ children }: { readonly children: ReactNode }) => (
  <h3 className="border-[#40222F] border-b-2 pt-6 pb-3 font-data text-[#7A5A69] text-[11px] uppercase tracking-[.2em]">
    {children}
  </h3>
);

/** Chave liga/desliga com nome e dica; a dica é lida junto com o botão. */
const SwitchRow = ({
  checked,
  children,
  disabled = false,
  hint,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly hint?: string;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) => {
  const id = useId();
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-[#E2D6D1] border-b py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-[#40222F] text-[15px]" id={`${id}-l`}>
          {label}
        </span>
        {hint ? (
          <span className="text-[#7A5A69] text-[13px]" id={`${id}-h`}>
            {hint}
          </span>
        ) : null}
        {children}
      </div>
      <button
        aria-checked={checked}
        aria-describedby={hint ? `${id}-h` : undefined}
        aria-labelledby={`${id}-l`}
        className={cn(
          "flex h-8 w-[52px] shrink-0 items-center rounded-full p-[3px] transition-colors focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
          checked
            ? "justify-end bg-[#8C1535]"
            : "justify-start border border-[#7A5A69] bg-[#E7DEDC]"
        )}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "rounded-full",
            checked ? "size-[26px] bg-[#F7F3F1]" : "size-6 bg-[#7A5A69]"
          )}
        />
      </button>
    </div>
  );
};

const NumberField = ({
  id,
  label,
  max,
  min,
  onChange,
  unit,
  value,
}: {
  readonly id: string;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly onChange: (value: number) => void;
  readonly unit: string;
  readonly value: number;
}) => (
  <label className="grid gap-1.5 text-[#7A5A69] text-[13px]" htmlFor={id}>
    {label}
    <span className="flex items-center gap-2">
      <Input
        className="w-[88px]"
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
      <span className="text-[#40222F] text-sm">{unit}</span>
    </span>
  </label>
);

const notificationHint = (permission: NotificationState) => {
  switch (permission) {
    case "granted":
      return "Ativadas neste navegador.";
    case "denied":
      return "Bloqueadas no navegador: libere nas permissões do site, ao lado do endereço.";
    case "default":
      return "Ao ligar, o navegador pede permissão.";
    default:
      return "Este navegador não oferece notificações do sistema.";
  }
};

/** O som escolhido; "Sem som" vale tanto para o tipo NONE quanto para o aviso desligado. */
const selectedSound = (settings: TimerSettings) =>
  !settings.timerSoundEnabled || settings.timerSoundType === "NONE"
    ? "NONE"
    : settings.timerSoundType;

export function TimerSettingsPanel({
  experience,
  handleSystemNotifications,
  notificationPermission,
  onClose,
  pending,
  previewTimerSound,
  saveSettings,
  setSettingsDraft,
  settingsDraft,
  settingsOpen,
}: {
  readonly experience: TimerExperience;
  readonly handleSystemNotifications: (enabled: boolean) => void;
  readonly notificationPermission: NotificationState;
  /** Fecha sem salvar e volta o rascunho para o que está salvo. */
  readonly onClose: () => void;
  readonly pending: boolean;
  readonly previewTimerSound: () => void;
  readonly saveSettings: () => void;
  readonly setSettingsDraft: (
    next: TimerSettings | ((current: TimerSettings) => TimerSettings)
  ) => void;
  readonly settingsDraft: TimerSettings;
  readonly settingsOpen: boolean;
}) {
  const [canVibrate, setCanVibrate] = useState(true);
  useEffect(() => {
    setCanVibrate("vibrate" in navigator);
  }, []);

  const set = <K extends keyof TimerSettings>(
    key: K,
    value: TimerSettings[K]
  ) => setSettingsDraft((current) => ({ ...current, [key]: value }));

  const sound = selectedSound(settingsDraft);
  const audible = sound !== "NONE";
  const isPomodoro = experience === "POMODORO";

  const changeSound = (value: string) => {
    const next = value as TimerSettings["timerSoundType"];
    setSettingsDraft((current) => ({
      ...current,
      timerSoundType: next,
      timerSoundEnabled: next === "NONE" ? current.timerSoundEnabled : true,
    }));
  };

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={settingsOpen}
    >
      <SheetContent
        className="w-[min(92vw,440px)] gap-0 bg-[#F7F3F1] p-0 sm:max-w-[440px]"
        side="right"
      >
        <SheetHeader className="border-[#E2D6D1] border-b px-7 pt-6 pr-14 pb-4 text-left">
          <SheetTitle className="font-display text-2xl text-[#40222F]">
            Preferências
          </SheetTitle>
          <SheetDescription className="text-[#7A5A69] text-[13px]">
            {isPomodoro
              ? "Ciclo e avisos. Valem para todas as sessões."
              : "Avisos e tela. O ciclo do Pomodoro fica na aba Pomodoro."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-7 pb-4">
          {isPomodoro ? (
            <section aria-label="Ciclo">
              <SectionTitle>Ciclo</SectionTitle>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 pb-2">
                <NumberField
                  id="timer-focus-minutes"
                  label="Foco"
                  max={180}
                  min={1}
                  onChange={(value) => set("focusMinutes", value)}
                  unit="min"
                  value={settingsDraft.focusMinutes}
                />
                <NumberField
                  id="timer-short-break-minutes"
                  label="Pausa curta"
                  max={60}
                  min={1}
                  onChange={(value) => set("shortBreakMinutes", value)}
                  unit="min"
                  value={settingsDraft.shortBreakMinutes}
                />
                <NumberField
                  id="timer-long-break-minutes"
                  label="Pausa longa"
                  max={90}
                  min={1}
                  onChange={(value) => set("longBreakMinutes", value)}
                  unit="min"
                  value={settingsDraft.longBreakMinutes}
                />
                <NumberField
                  id="timer-long-break-every"
                  label="Pausa longa a cada"
                  max={8}
                  min={2}
                  onChange={(value) => set("longBreakEvery", value)}
                  unit="focos"
                  value={settingsDraft.longBreakEvery}
                />
              </div>
              <SwitchRow
                checked={settingsDraft.timerAutoAdvance}
                hint="Sem precisar tocar em Começar."
                label="Começar a próxima fase automaticamente"
                onChange={(value) => set("timerAutoAdvance", value)}
              />
            </section>
          ) : null}

          <section aria-label="Ao terminar uma fase">
            <SectionTitle>Ao terminar uma fase</SectionTitle>
            <div className="flex items-end gap-3 pt-4 pb-2">
              <label
                className="grid flex-1 gap-1.5 text-[#7A5A69] text-[13px]"
                htmlFor="timer-sound-type"
              >
                Som
                <select
                  className="h-10 rounded-md border border-[#7A5A69] bg-[#F1EBE8] px-3 text-[#40222F] text-[15px]"
                  id="timer-sound-type"
                  onChange={(event) => changeSound(event.target.value)}
                  value={sound}
                >
                  {SOUND_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                disabled={!audible || settingsDraft.timerVolume === 0}
                onClick={previewTimerSound}
                type="button"
                variant="outline"
              >
                <PlayIcon aria-hidden="true" className="mr-2 size-4" />
                Ouvir som
              </Button>
            </div>
            {audible ? (
              <label
                className="flex items-center gap-3 pt-1 pb-3 text-[#40222F] text-sm"
                htmlFor="timer-volume"
              >
                Volume
                <input
                  className="h-10 flex-1 accent-[#8C1535]"
                  id="timer-volume"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    set("timerVolume", Number(event.target.value))
                  }
                  type="range"
                  value={settingsDraft.timerVolume}
                />
                <span className="w-10 text-right font-data text-sm">
                  {settingsDraft.timerVolume}%
                </span>
              </label>
            ) : null}
            <SwitchRow
              checked={settingsDraft.timerVibrationEnabled}
              hint={
                canVibrate
                  ? "No celular."
                  : "Este aparelho não vibra pelo navegador (comum no iPhone e no computador)."
              }
              label="Vibrar"
              onChange={(value) => set("timerVibrationEnabled", value)}
            />
            <SwitchRow
              checked={settingsDraft.systemNotificationsEnabled}
              disabled={notificationPermission === "unsupported"}
              hint={notificationHint(notificationPermission)}
              label="Notificação"
              onChange={handleSystemNotifications}
            >
              {notificationPermission === "granted" ? (
                <button
                  className="mt-1 w-fit text-[#8C1535] text-[13px] underline underline-offset-2"
                  onClick={() =>
                    showTimerNotification("Aviso do cronômetro", {
                      body: "As notificações estão funcionando.",
                      tag: "focus-timer-test",
                    })
                  }
                  type="button"
                >
                  Testar aviso
                </button>
              ) : null}
            </SwitchRow>
          </section>

          <section aria-label="Durante o foco">
            <SectionTitle>Durante o foco</SectionTitle>
            <SwitchRow
              checked={settingsDraft.timerOpenFocusOnStart}
              label="Abrir o modo foco ao começar"
              onChange={(value) => set("timerOpenFocusOnStart", value)}
            />
            <SwitchRow
              checked={settingsDraft.keepScreenAwake}
              hint="Em qualquer cronômetro em andamento."
              label="Manter a tela acesa"
              onChange={(value) => set("keepScreenAwake", value)}
            />
            <SwitchRow
              checked={settingsDraft.timerTickEnabled}
              disabled={!audible}
              hint={
                audible
                  ? "Só no foco do Pomodoro, com o som e o volume escolhidos acima."
                  : "Escolha um som acima para ouvir o tique-taque."
              }
              label="Som de tique-taque"
              onChange={(value) => set("timerTickEnabled", value)}
            />
          </section>

          <section aria-label="Fuso horário">
            <SectionTitle>Fuso horário</SectionTitle>
            <label
              className="grid gap-1.5 pt-4 text-[#7A5A69] text-[13px]"
              htmlFor="timer-timezone"
            >
              Usado para separar os dias nas metas e no histórico.
              <Input
                id="timer-timezone"
                list="member-timezones"
                maxLength={80}
                onChange={(event) => set("timezone", event.target.value)}
                value={settingsDraft.timezone}
              />
              <datalist id="member-timezones">
                <option value="America/Sao_Paulo" />
                <option value="America/Manaus" />
                <option value="America/Rio_Branco" />
                <option value="America/Fortaleza" />
                <option value="America/Belem" />
                <option value="Europe/Lisbon" />
                <option value="Europe/London" />
                <option value="UTC" />
              </datalist>
            </label>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-[#E2D6D1] border-t px-7 py-3.5">
          <button
            className="min-h-10 text-[#8C1535] text-sm underline underline-offset-2"
            onClick={() => setSettingsDraft(defaultTimerSettings)}
            type="button"
          >
            Restaurar padrões
          </button>
          <div className="flex gap-2">
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={pending} onClick={saveSettings} type="button">
              Salvar preferências
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
