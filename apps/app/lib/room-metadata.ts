import type { Metadata } from "next";

export const roomMetadata = (
  lessonTitle: string | null,
  courseTitle: string | null
): Metadata => ({
  robots: { follow: false, index: false },
  title:
    lessonTitle && courseTitle
      ? `${lessonTitle} · ${courseTitle} · Interprete`
      : "Aula · Interprete",
});
