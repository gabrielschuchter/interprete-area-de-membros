import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EventEditorDialog, TaskEditorDialog } from "./planner-editors";

afterEach(cleanup);

test("renders the task editor after it is requested", () => {
  render(
    <TaskEditorDialog
      onClose={vi.fn()}
      onSave={vi.fn().mockResolvedValue(undefined)}
      open
      parentTaskId={null}
      task={null}
      timezone="America/Sao_Paulo"
    />
  );

  expect(screen.getByRole("heading", { name: "Nova tarefa" })).toBeTruthy();
  expect(screen.getByLabelText("Título")).toBeTruthy();
});

test("renders the event editor after it is requested", () => {
  render(
    <EventEditorDialog
      event={null}
      onClose={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={vi.fn().mockResolvedValue(undefined)}
      onSave={vi.fn().mockResolvedValue(undefined)}
      open
      timezone="America/Sao_Paulo"
    />
  );

  expect(screen.getByRole("heading", { name: "Novo evento" })).toBeTruthy();
  expect(screen.getByLabelText("Título")).toBeTruthy();
});
