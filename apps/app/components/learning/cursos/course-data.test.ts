import { describe, expect, it } from "vitest";
import { buildCourseViewData } from "./course-data";

const lesson = (id: string, done: boolean) => ({
  description: null,
  id,
  progress: done ? [{ status: "COMPLETED" }] : [],
  slug: `aula-${id}`,
  title: `Aula ${id}`,
});

const course = {
  coverUrl: null,
  description: null,
  learningPath: null,
  modules: [
    { id: "m1", lessons: [lesson("1", true), lesson("2", true)], title: "Um" },
    {
      id: "m2",
      lessons: [lesson("3", false), lesson("4", false)],
      title: "Dois",
    },
  ],
  progress: { completedLessons: 2, percentage: 50, totalLessons: 4 },
  slug: "curso",
  title: "Curso",
};

describe("buildCourseViewData", () => {
  it("opens the module of the next lesson and numbers lessons across modules", () => {
    const data = buildCourseViewData(course);

    expect(data.continueHref).toBe("/cursos/curso/aula-3");
    expect(data.continueLabel).toBe("Continuar aula");
    expect(data.modules.map(({ open }) => open)).toEqual([false, true]);
    expect(data.modules[1]?.lessons.map(({ ordinal }) => ordinal)).toEqual([
      3, 4,
    ]);
  });

  it("highlights and opens the lesson the student came back from", () => {
    const data = buildCourseViewData(course, "aula-2");

    expect(data.highlightLessonId).toBe("2");
    expect(data.modules.map(({ open }) => open)).toEqual([true, false]);
  });

  it("ignores an unknown return slug", () => {
    expect(
      buildCourseViewData(course, "nao-existe").highlightLessonId
    ).toBeNull();
  });

  it("has no continue link when every lesson is done", () => {
    const finished = {
      ...course,
      modules: [{ id: "m1", lessons: [lesson("1", true)], title: "Um" }],
    };

    expect(buildCourseViewData(finished).continueHref).toBeNull();
  });
});
