import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import CommunityMeetingsError from "./encontros/error";
import CommunityError from "./error";

describe("Community error states", () => {
  afterEach(() => {
    cleanup();
  });

  test("offers a retry on the feed error", () => {
    const reset = vi.fn();
    render(
      <CommunityError error={new Error("feed unavailable")} reset={reset} />
    );

    expect(
      screen.getByRole("heading", { name: "Não deu para carregar o feed" })
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Confira sua conexão e tente de novo. Suas publicações não foram afetadas."
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  test("matches the meetings error copy and retries the route segment", () => {
    const reset = vi.fn();
    render(
      <CommunityMeetingsError
        error={new Error("meetings unavailable")}
        reset={reset}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Não deu para carregar os encontros",
      })
    ).toBeTruthy();
    expect(screen.getByText("Confira a conexão e tente de novo.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
