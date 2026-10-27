import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const respond = vi.hoisted(() => vi.fn());

vi.mock("../perfil/actions", () => ({
  respondToStudyGroupInvitation: respond,
}));

import { NotificationInvitationActions } from "./notification-invitation-actions";

afterEach(() => {
  cleanup();
  respond.mockReset();
});

it("accepts the invitation and offers the group link", async () => {
  respond.mockResolvedValue({ status: "accepted", slug: "grupo-qa" });
  const onResponded = vi.fn();
  render(
    <NotificationInvitationActions
      invitationId="inv-1"
      onResponded={onResponded}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));

  expect(await screen.findByText("Você entrou no grupo.")).toBeTruthy();
  const form = respond.mock.calls[0][0] as FormData;
  expect(form.get("invitationId")).toBe("inv-1");
  expect(form.get("response")).toBe("ACCEPTED");
  expect(
    screen.getByRole("link", { name: "Abrir grupo" }).getAttribute("href")
  ).toBe("/comunidade/grupos/grupo-qa");
  expect(onResponded).toHaveBeenCalledOnce();
});

it("declines without offering the group", async () => {
  respond.mockResolvedValue({ status: "declined", slug: "grupo-qa" });
  render(<NotificationInvitationActions invitationId="inv-2" />);

  fireEvent.click(screen.getByRole("button", { name: "Recusar" }));

  expect(await screen.findByText("Convite recusado.")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Abrir grupo" })).toBeNull();
});

it("keeps the buttons and explains when the response fails", async () => {
  respond.mockRejectedValue(new Error("offline"));
  render(<NotificationInvitationActions invitationId="inv-3" />);

  fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Aceitar" })).toBeTruthy();
});
