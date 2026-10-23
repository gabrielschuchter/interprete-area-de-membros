import { ArrowRightIcon, ChevronRightIcon, PlayCircleIcon } from "lucide-react";
import Image from "next/image";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { getPublishedActivities } from "@/lib/activities";
import { requireOnboardedMemberId } from "@/lib/authorization";
import { getHomeLearningSummary } from "@/lib/learning";
import { getMemberContinueWatching } from "@/lib/recordings";

const areas = [
  ["Cursos", "Aulas, trilhas e gravações", "/cursos"],
  ["Exercícios", "Listas de questões com gabarito e explicação", "/exercicios"],
  ["Atividades", "Atividades atribuídas e enviadas", "/atividades"],
  [
    "Biblioteca",
    "Materiais selecionados para complementar os estudos",
    "/biblioteca",
  ],
  ["Planejamento", "Organize seus próximos passos", "/planejamento"],
  ["Ferramentas", "Cronômetro, Pomodoro e suas notas", "/ferramentas"],
] as const;

const StudyOverview = async () => {
  const memberId = await requireOnboardedMemberId();
  const [courses, activities, recordings] = await Promise.all([
    getHomeLearningSummary(memberId),
    getPublishedActivities(memberId),
    getMemberContinueWatching(memberId),
  ]);
  const course =
    courses.find(
      (item) =>
        item.progress.completedLessons > 0 && item.progress.percentage < 100
    ) ?? courses.find((item) => item.progress.percentage < 100);
  const lesson = course?.modules
    .flatMap((module) => module.lessons)
    .find(
      (item) =>
        !item.progress.some((progress) => progress.status === "COMPLETED")
    );
  const recording = recordings.continueWatching[0];
  let next: {
    title: string;
    subtitle: string;
    href: string;
    progress: number | null;
    action: string;
  } = {
    title: "Seu próximo capítulo começa aqui.",
    subtitle: "Encontre uma aula, uma boa pergunta ou uma nova leitura.",
    href: "/cursos",
    progress: null,
    action: "Explorar aulas",
  };
  if (lesson && course) {
    next = {
      title: lesson.title,
      subtitle: course.title,
      href: `/cursos/${course.slug}/${lesson.slug}`,
      progress: course.progress.percentage,
      action: course.progress.completedLessons
        ? "Retomar aula"
        : "Começar aula",
    };
  } else if (recording) {
    next = {
      title: recording.asset.title,
      subtitle: recording.group.courseTitle,
      href: `/encontros/gravacoes?asset=${encodeURIComponent(recording.asset.id)}`,
      progress: recording.progress.durationSeconds
        ? Math.min(
            100,
            Math.round(
              (recording.progress.positionSeconds /
                recording.progress.durationSeconds) *
                100
            )
          )
        : null,
      action: "Retomar gravação",
    };
  }
  const pending = activities
    .filter(
      (activity) =>
        !activity.submissions[0] || activity.submissions[0].status === "DRAFT"
    )
    .slice(0, 3);
  return (
    <main className="study-overview" data-route-content-ready="study-overview">
      <header>
        <h1>Estudar</h1>
        <p>Comece pelo próximo passo.</p>
      </header>
      <section aria-labelledby="study-next-title" className="study-next">
        <Image
          alt=""
          aria-hidden="true"
          className="study-next-art"
          height={400}
          loading="eager"
          src="/brand/learning/study-corridor.svg"
          unoptimized
          width={250}
        />
        <div className="study-next-copy">
          <p>Seu próximo passo</p>
          <h2 id="study-next-title">{next.title}</h2>
          <p>{next.subtitle}</p>
          {next.progress !== null && (
            <div className="study-next-progress">
              <progress
                aria-label="Progresso do curso"
                max={100}
                value={next.progress}
              />
              <span>{next.progress}%</span>
            </div>
          )}
          <IntentLink className="study-next-action" href={next.href}>
            <PlayCircleIcon aria-hidden="true" className="size-4" />
            {next.action}
          </IntentLink>
        </div>
      </section>
      {pending.length > 0 && (
        <section
          aria-labelledby="study-after-title"
          className="study-overview-section"
        >
          <h2 id="study-after-title">Depois, nesta ordem</h2>
          <span aria-hidden="true" className="brand-rule" />
          <ol className="study-priority-list">
            {pending.map((activity, index) => (
              <li key={activity.id}>
                <IntentLink href={`/atividades/${activity.slug}`}>
                  <span className="study-priority-number">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{activity.title}</span>
                    <span className="mt-1 block text-muted-foreground text-sm">
                      {activity.course?.title ?? "Atividade para você"}
                    </span>
                  </span>
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </IntentLink>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section
        aria-labelledby="study-explore-title"
        className="study-overview-section"
      >
        <h2 id="study-explore-title">Explorar</h2>
        <span aria-hidden="true" className="brand-rule" />
        <nav aria-label="Áreas de Estudar" className="study-explore">
          {areas.map(([title, description, href]) => (
            <IntentLink href={href} key={href}>
              <span className="min-w-0 flex-1">
                <span className="study-explore-title">{title}</span>
                <span className="study-explore-description">{description}</span>
              </span>
              <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
            </IntentLink>
          ))}
        </nav>
      </section>
    </main>
  );
};
export default StudyOverview;
