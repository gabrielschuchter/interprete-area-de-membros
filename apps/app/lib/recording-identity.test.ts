import { describe, expect, test } from "vitest";
import {
  recordingGroupNameSearchWhere,
  recordingOwnerDisplayLabel,
} from "./recording-identity";

describe("recording identity privacy", () => {
  test("shows a legacy owner label only to the owner or full-access staff", () => {
    expect(
      recordingOwnerDisplayLabel("member-1", "member-1", false, "Camila")
    ).toBe("Camila");
    expect(
      recordingOwnerDisplayLabel("member-2", "member-1", false, "Camila")
    ).toBe("Conteúdo atribuído");
    expect(recordingOwnerDisplayLabel(null, "member-1", false, "Camila")).toBe(
      "Conteúdo atribuído"
    );
    expect(
      recordingOwnerDisplayLabel("member-2", "teacher-1", true, "Camila")
    ).toBe("Camila");
  });

  test("limits a member's name search to their own linked recording groups", () => {
    expect(recordingGroupNameSearchWhere("member-1", false, "Camila")).toEqual({
      memberId: "member-1",
      legacyStudentName: { contains: "Camila", mode: "insensitive" },
    });
    expect(recordingGroupNameSearchWhere("admin-1", true, "Camila")).toEqual({
      legacyStudentName: { contains: "Camila", mode: "insensitive" },
    });
  });
});
