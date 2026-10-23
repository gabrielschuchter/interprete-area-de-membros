import { describe, expect, test } from "vitest";
import {
  buildRoomOutline,
  inProgressPercent,
  type RoomOutlineLessonInput,
  withLessonCompleted,
} from "./room-outline";

const now = new Date("2026-10-23T12:00:00Z");
const lesson = (
  id: string,
  overrides: Partial<RoomOutlineLessonInput> = {}
): RoomOutlineLessonInput => ({
  completed: false,
  durationSeconds: 900,
  href: `/cursos/metodo/${id}`,
  id,
  positionSeconds: 0,
  releasesAt: null,
  title: `Aula ${id}`,
  videoAvailability: "ok",
  ...overrides,
});

const modules = [
  {
    id: "m1",
    title: "Fundamentos",
    lessons: [
      lesson("a", { completed: true }),
      lesson("b", { completed: true }),
    ],
  },
  {
    id: "m2",
    title: "Leitura crítica",
    lessons: [
      lesson("c", { positionSeconds: 450 }),
      lesson("d", { videoAvailability: "broken" }),
      lesson("e", { releasesAt: new Date("2026-11-01T00:00:00Z") }),
      lesson("f", { videoAvailability: "missing", durationSeconds: null }),
    ],
  },
];

describe("buildRoomOutline", () => {
  const outline = buildRoomOutline({ currentLessonId: "c", modules, now });

  test("numbers lessons across modules and counts every published lesson", () => {
    expect(
      outline.groups.flatMap((group) => group.items.map((item) => item.ordinal))
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(outline.completedCount).toBe(2);
    expect(outline.totalCount).toBe(6);
    expect(outline.groups[0]).toMatchObject({
      completedCount: 2,
      totalCount: 2,
    });
    expect(outline.currentGroupId).toBe("m2");
  });

  test("opens groups with the current or an unfinished lesson", () => {
    expect(outline.groups.map((group) => group.defaultOpen)).toEqual([
      false,
      true,
    ]);
    const current = buildRoomOutline({ currentLessonId: "a", modules, now });
    expect(current.groups[0]?.defaultOpen).toBe(true);
  });

  test("applies the second-line priority", () => {
    expect(outline.groups[1]?.items.map((item) => item.status)).toEqual([
      "current",
      "unavailable",
      "locked",
      "no_video",
    ]);
    const locked = outline.groups[1]?.items[2];
    expect(locked?.href).toBeNull();
    expect(locked?.locked).toBe(true);
  });

  test("shows progress only for unfinished lessons with a known duration", () => {
    expect(outline.groups[1]?.items[0]?.inProgressPercent).toBe(50);
    expect(inProgressPercent(true, 450, 900)).toBeNull();
    expect(inProgressPercent(false, 450, null)).toBeNull();
    expect(inProgressPercent(false, 2000, 900)).toBe(100);
    expect(outline.groups[1]?.items[3]?.durationMinutes).toBeNull();
    expect(outline.groups[1]?.items[0]?.durationMinutes).toBe(15);
  });

  test("updates counters optimistically and back", () => {
    const marked = withLessonCompleted(outline, "c", true);
    expect(marked.completedCount).toBe(3);
    expect(marked.groups[1]?.completedCount).toBe(1);
    expect(marked.groups[1]?.items[0]?.inProgressPercent).toBeNull();
    const unmarked = withLessonCompleted(marked, "a", false);
    expect(unmarked.completedCount).toBe(2);
    expect(unmarked.groups[0]?.completedCount).toBe(1);
  });
});
