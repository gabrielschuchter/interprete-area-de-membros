import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SingleFlightForm, SingleFlightSubmit } from "./single-flight-form";

describe("SingleFlightForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("blocks repeated submits while the server action is pending", async () => {
    let finishAction: (() => void) | undefined;
    const onSettled = vi.fn();
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishAction = resolve;
        })
    );

    render(
      <SingleFlightForm action={action} onSettled={onSettled}>
        <SingleFlightSubmit pendingLabel="Salvando…">Salvar</SingleFlightSubmit>
      </SingleFlightForm>
    );

    const form = screen.getByRole("button", { name: "Salvar" }).closest("form");
    if (!form) {
      throw new Error("Formulário de envio único não encontrado");
    }

    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(onSettled).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeTruthy();

    finishAction?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty(
        "disabled",
        false
      )
    );
    expect(onSettled).toHaveBeenCalledTimes(1);

    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(onSettled).toHaveBeenCalledTimes(1);
    finishAction?.();
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(2));
  });
});
