"use client";

import { ArrowRightIcon, LockIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { CatalogBookmark } from "../learning-catalog";
import type { LearningRailCard } from "../learning-content-rail";

export interface CursosCourse extends LearningRailCard {
  readonly id: string;
  readonly lessonCount: number;
  readonly progress: number;
  readonly trailId: string | null;
}

export interface CursosTrail {
  readonly courseIds: readonly string[];
  readonly description: string | null;
  readonly id: string;
  readonly title: string;
}

export interface CursosRail {
  readonly cards: readonly LearningRailCard[];
  readonly description?: string | null;
  readonly headingId: string;
  readonly title: string;
}

export interface CursosResumeView {
  readonly courseTitle: string;
  readonly href: string;
  readonly lessonOrdinal: number;
  readonly lessonTitle: string;
  readonly moduleTitle: string;
  readonly positionSeconds: number;
  readonly progressPercent: number | null;
}

type CursosFilter = "all" | "doing" | "todo" | "done";

const filters: readonly { id: CursosFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "doing", label: "Em andamento" },
  { id: "todo", label: "Não iniciados" },
  { id: "done", label: "Concluídos" },
];

const matchesFilter = (course: CursosCourse, filter: CursosFilter) => {
  if (filter === "doing") {
    return course.progress > 0 && course.progress < 100;
  }
  if (filter === "todo") {
    return course.progress === 0;
  }
  if (filter === "done") {
    return course.progress === 100;
  }
  return true;
};

const clock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
};

const CourseCard = ({
  card,
  size,
}: {
  readonly card: LearningRailCard;
  readonly size: "grid" | "rail";
}) => {
  const progress =
    typeof card.progress === "number"
      ? Math.round(Math.max(0, Math.min(100, card.progress)))
      : null;
  const body = (
    <>
      <span className="cursos-card__cover">
        <Image
          alt=""
          fill
          sizes={size === "rail" ? "320px" : "(min-width: 1024px) 33vw, 100vw"}
          src={card.coverUrl || "/brand/learning/course-study.svg"}
          unoptimized
        />
        <span aria-hidden="true" className="cursos-meander" />
        {progress && progress > 0 ? (
          <span aria-hidden="true" className="cursos-card__line">
            <span
              className="cursos-card__fill"
              style={{ width: `${progress}%` }}
            />
          </span>
        ) : null}
        {card.disabled ? (
          <span className="cursos-card__lock">
            <LockIcon aria-hidden="true" size={16} />
          </span>
        ) : null}
      </span>
      <span className="cursos-card__kind">{card.label ?? "Conteúdo"}</span>
      <span className="cursos-card__title">{card.title}</span>
      {card.description ? (
        <span className="cursos-card__desc">{card.description}</span>
      ) : null}
      {card.meta ? (
        <span className="cursos-card__meta">{card.meta}</span>
      ) : null}
    </>
  );

  return (
    <li className="cursos-card" data-size={size}>
      {card.disabled ? (
        <div aria-disabled="true" className="cursos-card__link">
          {body}
        </div>
      ) : (
        <IntentLink className="cursos-card__link" href={card.href}>
          {body}
        </IntentLink>
      )}
      <CatalogBookmark card={card} />
    </li>
  );
};

const Rail = ({ rail }: { readonly rail: CursosRail }) =>
  rail.cards.length > 0 ? (
    <section aria-labelledby={rail.headingId} className="cursos-section">
      <header className="cursos-section__head">
        <h2 id={rail.headingId}>{rail.title}</h2>
        {rail.description ? <p>{rail.description}</p> : null}
      </header>
      <ul className="cursos-rail">
        {rail.cards.map((card) => (
          <CourseCard card={card} key={card.href} size="rail" />
        ))}
      </ul>
    </section>
  ) : null;

const ResumeBlock = ({ resume }: { readonly resume: CursosResumeView }) => (
  <section aria-labelledby="cursos-resume-title" className="cursos-resume">
    <div className="cursos-resume__text">
      <p className="cursos-eyebrow">Retomar</p>
      <h2 id="cursos-resume-title">{resume.lessonTitle}</h2>
      <p className="cursos-resume__where">
        {resume.courseTitle} · {resume.moduleTitle} · aula{" "}
        {resume.lessonOrdinal}
      </p>
      {resume.progressPercent === null ? null : (
        <div className="cursos-resume__bar">
          <div aria-hidden="true" className="cursos-resume__track">
            <span
              className="cursos-resume__fill"
              style={{ width: `${resume.progressPercent}%` }}
            />
          </div>
          <span className="cursos-resume__stamp">
            você parou em {clock(resume.positionSeconds)} ·{" "}
            {resume.progressPercent}% da aula
          </span>
        </div>
      )}
    </div>
    <IntentLink className="cursos-button" href={resume.href}>
      Retomar aula
      <ArrowRightIcon aria-hidden="true" size={16} />
    </IntentLink>
  </section>
);

const TrailChain = ({
  courses,
  trail,
}: {
  readonly courses: readonly CursosCourse[];
  readonly trail: CursosTrail;
}) => {
  const done = courses.filter(({ progress }) => progress === 100).length;
  return (
    <section
      aria-labelledby={`cursos-trail-${trail.id}`}
      className="cursos-section"
    >
      <header className="cursos-section__head">
        <h2 id={`cursos-trail-${trail.id}`}>{trail.title}</h2>
        <p>
          {trail.description ? `${trail.description} ` : ""}
          <span className="cursos-mono">
            {done} de {courses.length} cursos concluídos
          </span>
        </p>
      </header>
      <ol className="cursos-chain">
        {courses.map((course, index) => (
          <li className="cursos-chain__row" key={course.id}>
            <IntentLink className="cursos-chain__item" href={course.href}>
              <span aria-hidden="true" className="cursos-chain__n">
                {index + 1}
              </span>
              <span className="cursos-chain__text">
                <span className="cursos-chain__title">{course.title}</span>
                <span className="cursos-card__meta">{course.meta}</span>
              </span>
              <span aria-hidden="true" className="cursos-chain__bar">
                <span
                  className="cursos-chain__fill"
                  style={{ width: `${course.progress}%` }}
                />
              </span>
            </IntentLink>
          </li>
        ))}
      </ol>
    </section>
  );
};

export const CursosView = ({
  assigned,
  courses,
  rails,
  resume,
  trails,
}: {
  readonly assigned: readonly LearningRailCard[];
  readonly courses: readonly CursosCourse[];
  readonly rails: readonly CursosRail[];
  readonly resume: CursosResumeView | null;
  readonly trails: readonly CursosTrail[];
}) => {
  const [filter, setFilter] = useState<CursosFilter>("all");
  const visible = courses.filter((course) => matchesFilter(course, filter));
  const trailed = new Map(trails.map((trail) => [trail.id, trail]));
  const loose = visible.filter(
    ({ trailId }) => trailId === null || !trailed.has(trailId)
  );
  const counts = (id: CursosFilter) =>
    courses.filter((course) => matchesFilter(course, id)).length;

  return (
    <div className="cursos" data-route-content-ready="learn">
      {resume ? <ResumeBlock resume={resume} /> : null}
      <Rail
        rail={{
          cards: assigned,
          headingId: "assigned-learning-title",
          title: "Enviados para você",
        }}
      />
      {courses.length > 0 ? (
        <section aria-labelledby="cursos-all-title" className="cursos-section">
          <header className="cursos-section__head cursos-section__head--row">
            <h2 id="cursos-all-title">Seus cursos</h2>
            <fieldset className="cursos-filter">
              <legend className="sr-only">Filtrar cursos</legend>
              {filters.map(({ id, label }) => (
                <button
                  aria-pressed={filter === id}
                  className="cursos-filter__option"
                  key={id}
                  onClick={() => setFilter(id)}
                  type="button"
                >
                  {label}
                  <span className="cursos-mono">{counts(id)}</span>
                </button>
              ))}
            </fieldset>
          </header>
          {visible.length === 0 ? (
            <p className="cursos-empty">
              Nenhum curso nesta seleção. Escolha outro filtro para ver o
              restante.
            </p>
          ) : null}
          {loose.length > 0 ? (
            <ul className="cursos-grid">
              {loose.map((course) => (
                <CourseCard card={course} key={course.id} size="grid" />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {trails.map((trail) => {
        const inTrail = visible.filter(({ trailId }) => trailId === trail.id);
        return inTrail.length > 0 ? (
          <TrailChain courses={inTrail} key={trail.id} trail={trail} />
        ) : null;
      })}
      {rails.map((rail) => (
        <Rail key={rail.headingId} rail={rail} />
      ))}
    </div>
  );
};
