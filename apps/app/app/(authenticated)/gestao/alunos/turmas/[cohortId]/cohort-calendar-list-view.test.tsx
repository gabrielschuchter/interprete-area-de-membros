import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CohortCalendarListView } from "./cohort-calendar-list-view";

afterEach(cleanup);

test("shows the empty state for a calendar period without items", () => {
  render(
    <CohortCalendarListView
      archived={false}
      events={[]}
      items={[]}
      onEdit={vi.fn()}
      onEditMeeting={vi.fn()}
      onException={vi.fn()}
    />
  );

  expect(screen.getByText("Não há itens neste período.")).toBeTruthy();
});
