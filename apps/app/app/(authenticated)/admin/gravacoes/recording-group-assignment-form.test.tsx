import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RecordingGroupAssignmentForm } from "./recording-group-assignment-form";

afterEach(cleanup);

describe("RecordingGroupAssignmentForm", () => {
  test("requires identity confirmation and unique accessible evidence fields", () => {
    render(
      <div>
        {["group-a", "group-b"].map((groupId) => (
          <RecordingGroupAssignmentForm
            action={vi.fn()}
            attachmentCount={1}
            defaultMemberId={null}
            groupId={groupId}
            key={groupId}
            members={[]}
            recordingCount={3}
          />
        ))}
      </div>
    );

    const confirmations = screen.getAllByRole("checkbox");
    expect(confirmations).toHaveLength(2);
    expect(confirmations.every((input) => input.hasAttribute("required"))).toBe(
      true
    );

    const evidenceFields = screen.getAllByLabelText("Evidência consultada");
    expect(evidenceFields).toHaveLength(2);
    expect(evidenceFields.map((field) => field.getAttribute("id"))).toEqual([
      "recording-evidence-group-a",
      "recording-evidence-group-b",
    ]);
    expect(
      evidenceFields.every(
        (field) =>
          field.getAttribute("minlength") === "20" &&
          field.getAttribute("maxlength") === "1000" &&
          field.hasAttribute("required")
      )
    ).toBe(true);

    const memberSearchFields = screen.getAllByLabelText("Buscar membro");
    expect(memberSearchFields).toHaveLength(2);
    expect(new Set(memberSearchFields.map((field) => field.id)).size).toBe(2);
  });
});
