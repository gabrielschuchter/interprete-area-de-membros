import { describe, expect, test } from "vitest";
import { getDirectlyAssignedCourseIds } from "./learning-catalog-domain";

describe("getDirectlyAssignedCourseIds", () => {
  test("returns released course assignments without hiding module or lesson grants", () => {
    const at = new Date("2026-10-14T12:00:00.000Z");
    const ids = getDirectlyAssignedCourseIds(
      [
        { availableAt: null, target: { id: "course-now", type: "COURSE" } },
        {
          availableAt: new Date("2026-10-14T11:00:00.000Z"),
          target: { id: "course-released", type: "COURSE" },
        },
        {
          availableAt: new Date("2026-10-14T13:00:00.000Z"),
          target: { id: "course-scheduled", type: "COURSE" },
        },
        { availableAt: null, target: { id: "module-1", type: "MODULE" } },
        { availableAt: null, target: { id: "lesson-1", type: "LESSON" } },
      ],
      at
    );

    expect([...ids]).toEqual(["course-now", "course-released"]);
  });
});
