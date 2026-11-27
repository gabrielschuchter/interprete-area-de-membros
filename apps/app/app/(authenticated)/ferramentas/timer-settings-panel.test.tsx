import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultTimerSettings,
  type TimerSettings,
} from "@/lib/focus-timer-settings";
import { TimerSettingsPanel } from "./timer-settings-panel";

vi.mock("@/components/focus-timer-audio", () => ({
  showTimerNotification: vi.fn(),
}));

const SAVE = /Salvar preferências/;
const LISTEN = /Ouvir som/;
const FOCO = /^Foco/;
const VOLUME = /Volume/;
const BLOCKED = /Bloqueadas no navegador/;

const Harness = ({
  experience = "POMODORO",
  initial = {},
  notificationPermission = "default",
  onClose = vi.fn(),
  save = vi.fn(),
  notify = vi.fn(),
}: {
  readonly experience?: "POMODORO" | "STOPWATCH" | "COUNTDOWN";
  readonly initial?: Partial<TimerSettings>;
  readonly notificationPermission?: NotificationPermission | "unsupported";
  readonly onClose?: () => void;
  readonly save?: () => void;
  readonly notify?: (enabled: boolean) => void;
}) => {
  const [draft, setDraft] = useState<TimerSettings>({
    ...defaultTimerSettings,
    ...initial,
  });
  return (
    <TimerSettingsPanel
      experience={experience}
      handleSystemNotifications={notify}
      notificationPermission={notificationPermission}
      onClose={onClose}
      pending={false}
      previewTimerSound={vi.fn()}
      saveSettings={save}
      setSettingsDraft={setDraft}
      settingsDraft={draft}
      settingsOpen
    />
  );
};

afterEach(cleanup);

describe("TimerSettingsPanel", () => {
  it("mostra o ciclo só no Pomodoro", () => {
    render(<Harness />);
    expect(screen.getByLabelText(FOCO)).toBeTruthy();
    cleanup();
    render(<Harness experience="STOPWATCH" />);
    expect(screen.queryByLabelText(FOCO)).toBeNull();
  });

  it("com Sem som, esconde volume e desativa Ouvir e tique-taque", () => {
    render(<Harness initial={{ timerSoundType: "NONE" }} />);
    expect(screen.queryByLabelText(VOLUME)).toBeNull();
    expect(
      (screen.getByRole("button", { name: LISTEN }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole("switch", {
          name: "Som de tique-taque",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it("liga e desliga as chaves no rascunho", () => {
    render(<Harness />);
    const vibrate = screen.getByRole("switch", { name: "Vibrar" });
    expect(vibrate.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(vibrate);
    expect(vibrate.getAttribute("aria-checked")).toBe("false");
  });

  it("escolher um som religa o aviso sonoro desligado", () => {
    render(<Harness initial={{ timerSoundEnabled: false }} />);
    const select = screen.getByLabelText("Som") as HTMLSelectElement;
    expect(select.value).toBe("NONE");
    fireEvent.change(select, { target: { value: "WOOD" } });
    expect(select.value).toBe("WOOD");
  });

  it("Salvar e Cancelar chamam as ações", () => {
    const save = vi.fn();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} save={save} />);
    fireEvent.click(screen.getByRole("button", { name: SAVE }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("avisa quando a notificação está bloqueada e delega a chave", () => {
    const notify = vi.fn();
    render(<Harness notificationPermission="denied" notify={notify} />);
    expect(screen.getByText(BLOCKED)).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Notificação" }));
    expect(notify).toHaveBeenCalledWith(true);
  });

  it("sem suporte a notificação, a chave fica desativada", () => {
    render(<Harness notificationPermission="unsupported" />);
    expect(
      (screen.getByRole("switch", { name: "Notificação" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
