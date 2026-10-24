import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  courses: vi.fn(),
  activities: vi.fn(),
  recordings: vi.fn(),
}));
vi.mock("@/lib/authorization", () => ({
  requireOnboardedMemberId: mocks.auth,
}));
vi.mock("@/lib/learning", () => ({ getHomeLearningSummary: mocks.courses }));
vi.mock("@/lib/activities", () => ({
  getPublishedActivities: mocks.activities,
}));
vi.mock("@/lib/recordings", () => ({
  getMemberContinueWatching: mocks.recordings,
}));
vi.mock("@/app/(authenticated)/components/intent-link", () => ({
  IntentLink: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({ default: () => null }));

import StudyOverview from "./study-overview";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue("qa");
  mocks.courses.mockResolvedValue([]);
  mocks.activities.mockResolvedValue([]);
  mocks.recordings.mockResolvedValue({ continueWatching: [] });
});
test("offers a truthful first step and all study areas without a metrics dashboard", async () => {
  const html = renderToStaticMarkup(await StudyOverview());
  expect(html).toContain("Comece pelo próximo passo.");
  expect(html).toContain("Explorar aulas");
  for (const href of [
    "/cursos",
    "/atividades",
    "/biblioteca",
    "/exercicios",
    "/planejamento",
    "/ferramentas",
  ]) {
    expect(html).toContain(`href="${href}"`);
  }
  expect(html).not.toContain("min estudados");
  expect(html).not.toContain("Depois, nesta ordem");
});
test("resumes the first unfinished authorized lesson and omits submitted activities", async () => {
  mocks.courses.mockResolvedValue([
    {
      slug: "curso",
      title: "Curso",
      progress: { completedLessons: 1, percentage: 50 },
      modules: [
        {
          lessons: [
            {
              slug: "a",
              title: "Concluída",
              progress: [{ status: "COMPLETED" }],
            },
            { slug: "b", title: "Próxima aula", progress: [] },
          ],
        },
      ],
    },
  ]);
  mocks.activities.mockResolvedValue([
    { id: "1", slug: "pendente", title: "Pendente", submissions: [] },
    {
      id: "2",
      slug: "enviada",
      title: "Já enviada",
      submissions: [{ status: "SUBMITTED" }],
    },
  ]);
  const html = renderToStaticMarkup(await StudyOverview());
  expect(html).toContain('href="/cursos/curso/b"');
  expect(html).toContain("Retomar aula");
  expect(html).toContain('href="/atividades/pendente"');
  expect(html).not.toContain("Já enviada");
});
test("does not read content when onboarding authorization redirects", async () => {
  mocks.auth.mockRejectedValue(new Error("redirect"));
  await expect(StudyOverview()).rejects.toThrow("redirect");
  expect(mocks.courses).not.toHaveBeenCalled();
});
