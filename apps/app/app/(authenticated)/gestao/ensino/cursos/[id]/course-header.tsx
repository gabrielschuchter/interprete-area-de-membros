import Link from "next/link";
import { GestaoCrumbTail } from "../../../gestao-crumbs";
import { CourseStatusButton } from "./course-status-button";

const tabs = [
  ["conteudo", "Conteúdo", ""],
  ["acesso", "Turmas e acesso", "/turmas"],
  ["configuracoes", "Configurações", "/configuracoes"],
  ["publicacao", "Publicação", "/publicacao"],
] as const;

const statusMeta = {
  DRAFT: { label: "Rascunho", icon: "pencil", tone: "neutral" },
  SCHEDULED: { label: "Agendado", icon: "clock", tone: "warn" },
  PUBLISHED: { label: "Publicado", icon: "check", tone: "active" },
  ARCHIVED: { label: "Arquivado", icon: "archive", tone: "neutral" },
} as const;

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const savedAgo = (date: Date) => {
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) {
    return "agora";
  }
  if (Math.abs(minutes) < 60) {
    return relative.format(minutes, "minute");
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) {
    return relative.format(hours, "hour");
  }
  return relative.format(Math.round(hours / 24), "day");
};

export interface CourseHeaderCourse {
  readonly id: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
  readonly title: string;
  readonly updatedAt: Date;
}

export const GestaoCourseHeader = ({
  active,
  course,
}: {
  readonly active: (typeof tabs)[number][0];
  readonly course: CourseHeaderCourse;
}) => {
  const meta = statusMeta[course.status];
  return (
    <>
      <GestaoCrumbTail items={[{ label: course.title }]} />
      <header className="gt-detail-heading gk-course-heading">
        <div className="gt-detail-title">
          <h1>{course.title}</h1>
          <span className="gk-chip" data-tone={meta.tone}>
            {meta.label}
          </span>
        </div>
        <div className="gt-detail-actions">
          <span className="gk-course-saved">
            Atualizado {savedAgo(course.updatedAt)}
          </span>
          <Link
            className="gk-btn"
            href={`/gestao/ensino/cursos/${course.id}/preview`}
            prefetch={false}
          >
            Pré-visualizar como aluno
          </Link>
          <Link
            className="gk-btn"
            href={`/gestao/ensino/cursos/${course.id}/publicacao`}
            prefetch={false}
          >
            Verificar publicação
          </Link>
          <CourseStatusButton courseId={course.id} status={course.status} />
        </div>
      </header>
      <nav aria-label="Seções do curso" className="gt-cohort-tabs">
        {tabs.map(([key, label, suffix]) => (
          <Link
            aria-current={active === key ? "page" : undefined}
            className="gt-cohort-tab"
            data-active={String(active === key)}
            href={`/gestao/ensino/cursos/${course.id}${suffix}`}
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
};
