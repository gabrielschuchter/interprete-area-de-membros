import { beforeEach, describe, expect, test, vi } from "vitest";

const { databaseMock, transactionMock } = vi.hoisted(() => ({
  databaseMock: { $transaction: vi.fn() },
  transactionMock: {
    importedRecordingGroup: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    importedRecordingGroupAssignment: { create: vi.fn() },
    member: { findUnique: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ImportedRecordingGroupAssignmentAction: {
    ASSIGNED: "ASSIGNED",
    REASSIGNED: "REASSIGNED",
  },
  database: databaseMock,
}));

import { assignRecordingGroup } from "./recording-groups";

const assignmentInput = {
  changedByMemberId: "admin-1",
  groupId: "group-1",
  identityConfirmed: true,
  identityEvidence: "Conferi o e-mail verificado na origem oficial.",
  memberId: "member-1",
};

describe("historical recording group assignment", () => {
  beforeEach(() => {
    databaseMock.$transaction
      .mockReset()
      .mockImplementation((callback) => callback(transactionMock));
    transactionMock.importedRecordingGroup.findUnique
      .mockReset()
      .mockResolvedValue({ id: "group-1", memberId: null });
    transactionMock.importedRecordingGroup.updateMany
      .mockReset()
      .mockResolvedValue({ count: 1 });
    transactionMock.importedRecordingGroupAssignment.create
      .mockReset()
      .mockResolvedValue({});
    transactionMock.member.findUnique
      .mockReset()
      .mockResolvedValue({ id: "member-1" });
  });

  test("requires an explicit identity confirmation before opening a transaction", async () => {
    await expect(
      assignRecordingGroup({
        ...assignmentInput,
        identityConfirmed: false,
      })
    ).rejects.toThrow("recording_identity_confirmation_required");

    expect(databaseMock.$transaction).not.toHaveBeenCalled();
  });

  test("requires a bounded evidence note before opening a transaction", async () => {
    await expect(
      assignRecordingGroup({
        ...assignmentInput,
        identityEvidence: "Nome parecido",
      })
    ).rejects.toThrow("recording_identity_evidence_invalid");
    await expect(
      assignRecordingGroup({
        ...assignmentInput,
        identityEvidence: "x".repeat(1001),
      })
    ).rejects.toThrow("recording_identity_evidence_invalid");

    expect(databaseMock.$transaction).not.toHaveBeenCalled();
  });

  test("stores the identity evidence with the access change", async () => {
    await expect(assignRecordingGroup(assignmentInput)).resolves.toMatchObject({
      changed: true,
      groupId: "group-1",
      memberId: "member-1",
      previousMemberId: null,
    });

    expect(
      transactionMock.importedRecordingGroupAssignment.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ASSIGNED",
        changedByMemberId: "admin-1",
        groupId: "group-1",
        memberId: "member-1",
        note: "Conferi o e-mail verificado na origem oficial.",
        previousMemberId: null,
      }),
    });
  });

  test("does not record duplicate history when the group already belongs to the member", async () => {
    transactionMock.importedRecordingGroup.findUnique.mockResolvedValue({
      id: "group-1",
      memberId: "member-1",
    });

    await expect(assignRecordingGroup(assignmentInput)).resolves.toMatchObject({
      changed: false,
      memberId: "member-1",
    });

    expect(
      transactionMock.importedRecordingGroup.updateMany
    ).not.toHaveBeenCalled();
    expect(
      transactionMock.importedRecordingGroupAssignment.create
    ).not.toHaveBeenCalled();
  });
});
