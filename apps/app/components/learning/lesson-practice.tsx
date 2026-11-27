import { BookOpenIcon, ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { getLessonPractice } from "@/lib/content-links";

const libraryKindLabels: Record<string, string> = {
  ARTICLE: "Artigo",
  GUIDE: "Guia",
  LINK: "Link",
  PDF: "PDF",
  VIDEO: "Vídeo",
};

const questionsLabel = (count: number) =>
  `${count} ${count === 1 ? "questão" : "questões"}`;

/**
 * "Continue praticando": listas de exercícios e materiais que o professor
 * vinculou à aula. É só uma sugestão; some quando não há nada vinculado
 * (ou nada que o aluno possa abrir).
 */
export const LessonPractice = async ({
  lessonId,
  memberId,
  variant,
}: {
  readonly lessonId: string;
  readonly memberId: string;
  readonly variant: "page" | "room";
}) => {
  const practice = await getLessonPractice(memberId, lessonId);
  if (practice.exerciseLists.length + practice.libraryItems.length === 0) {
    return null;
  }

  const rows = [
    ...practice.exerciseLists.map((list) => ({
      href: `/exercicios/listas/${list.slug}`,
      icon: "list" as const,
      id: `l-${list.id}`,
      meta: questionsLabel(list.questionCount),
      title: list.title,
      type: "Exercícios",
    })),
    ...practice.libraryItems.map((item) => ({
      href: `/biblioteca/${item.id}`,
      icon: "book" as const,
      id: `m-${item.id}`,
      meta: libraryKindLabels[item.kind] ?? "Material",
      title: item.title,
      type: "Biblioteca",
    })),
  ];

  if (variant === "room") {
    return (
      <section
        aria-labelledby="room-practice-title"
        className="room__section room__materials"
        id="room-practice"
      >
        <h2 className="room__h2" id="room-practice-title">
          Continue praticando
        </h2>
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <Link className="room-material" href={row.href}>
                {row.icon === "list" ? (
                  <ClipboardListIcon aria-hidden="true" size={16} />
                ) : (
                  <BookOpenIcon aria-hidden="true" size={16} />
                )}
                <span className="room-material__title">{row.title}</span>
                <span className="room-material__type">
                  {row.type} · {row.meta}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="lesson-practice-title"
      className="border-brand-action/50 border-l-2 bg-brand-action/5 px-5 py-6 sm:px-7"
    >
      <p className="brand-eyebrow">Sugestão do professor</p>
      <h2 className="mt-2 font-display text-2xl" id="lesson-practice-title">
        Continue praticando
      </h2>
      <ul className="mt-4 divide-y">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              className="flex min-h-11 items-center gap-3 py-3 text-brand-structural hover:underline"
              href={row.href}
            >
              {row.icon === "list" ? (
                <ClipboardListIcon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                />
              ) : (
                <BookOpenIcon aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{row.title}</span>
              <span className="font-data text-muted-foreground text-xs uppercase tracking-[0.1em]">
                {row.type} · {row.meta}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
