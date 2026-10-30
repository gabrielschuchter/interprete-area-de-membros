import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CohortCalendarEventForm } from "./cohort-calendar-event-form";

afterEach(cleanup);

test("renders the event form when an editor is opened", () => {
  render(
    <CohortCalendarEventForm
      archived={false}
      eventId={null}
      eventPublished={false}
      form={{
        allDay: false,
        color: "#6B5B64",
        description: "",
        endsAt: "",
        recurrence: "NONE",
        recurrenceUntil: "",
        startsAt: "2026-10-30T10:00",
        title: "",
      }}
      onChange={vi.fn()}
      onClose={vi.fn()}
      onCreate={vi.fn()}
      onPublish={vi.fn()}
      onRefresh={vi.fn()}
      onSaveDraft={vi.fn()}
      pending={false}
      result={null}
    />
  );

  expect(
    screen.getByRole("heading", { name: "Novo evento da turma" })
  ).toBeTruthy();
  expect(screen.getByLabelText("Título")).toBeTruthy();
});
