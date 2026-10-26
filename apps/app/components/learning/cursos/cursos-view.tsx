"use client";

import { CheckIcon, ListFilterIcon, PlayIcon } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { CatalogBookmark } from "../learning-catalog";
import type { LearningRailCard } from "../learning-content-rail";
import { CourseCover, CoverArt, clock, coverLook } from "./cover";

export interface CursosCourse extends LearningRailCard {
  readonly completedLessons: number;
  readonly id: string;
  readonly lessonCount: number;
  readonly moduleCount: number;
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
  readonly completedLessons: number;
  readonly courseHref: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly durationSeconds: number | null;
  readonly href: string;
  readonly lessonOrdinal: number;
  readonly lessonTitle: string;
  readonly moduleOrdinal: number;
  readonly next: readonly {
    readonly href: string;
    readonly minutes: number | null;
    readonly ordinal: number;
    readonly title: string;
  }[];
  readonly positionSeconds: number;
  readonly progressPercent: number | null;
  readonly totalLessons: number;
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

// In progress first, then not started, then done, keeping the school's order.
const rank = (course: CursosCourse) => {
  if (course.progress > 0 && course.progress < 100) {
    return 0;
  }
  return course.progress === 0 ? 1 : 2;
};

const structure = (course: CursosCourse) => {
  const modules = `${course.moduleCount} módulo${course.moduleCount === 1 ? "" : "s"}`;
  return course.moduleCount > 0
    ? `${modules} · ${course.lessonCount} aulas`
    : "Em preparação";
};

const CardMeta = ({ card }: { readonly card: LearningRailCard }) => (
  <span className="cb-cc__m">
    <span>{card.meta}</span>
    {card.actionLabel ? <b>{card.actionLabel}</b> : null}
  </span>
);

const CourseCard = ({
  card,
  desc,
  numeral,
}: {
  readonly card: LearningRailCard | CursosCourse;
  readonly desc?: boolean;
  readonly numeral?: number;
}) => {
  const course = "lessonCount" in card ? card : null;
  const progress =
    typeof card.progress === "number"
      ? Math.round(Math.max(0, Math.min(100, card.progress)))
      : null;
  const id = course?.id ?? card.bookmark?.targetId ?? card.href;
  const body = (
    <>
      <CourseCover
        barPercent={progress}
        coverUrl={card.coverUrl}
        done={progress === 100}
        id={id}
        kind={card.label ?? "Conteúdo"}
        locked={card.disabled}
        numeral={numeral}
        title={card.title}
      />
      <span className="cb-cc__body">
        <span className="cb-cc__t">{card.title}</span>
        {desc && card.description ? (
          <span className="cb-cc__d">{card.description}</span>
        ) : null}
        {course ? (
          <span className="cb-cc__m">
            <span>{structure(course)}</span>
            {course.progress === 0 ? <b>Novo</b> : null}
            {course.progress > 0 && course.progress < 100 ? (
              <b>
                {course.completedLessons} de {course.lessonCount} aulas
              </b>
            ) : null}
            {course.progress === 100 ? <span>Concluído</span> : null}
          </span>
        ) : (
          <CardMeta
            card={
              card.disabled
                ? { ...card, actionLabel: "Aguarde a liberação" }
                : card
            }
          />
        )}
      </span>
    </>
  );
  return (
    <li className="cb-ccw">
      {card.disabled ? (
        <div aria-disabled="true" className="cb-cc" title={card.title}>
          {body}
        </div>
      ) : (
        <IntentLink className="cb-cc" href={card.href} title={card.title}>
          {body}
        </IntentLink>
      )}
      {card.bookmark && !card.disabled ? (
        <div className="cb-bm">
          <CatalogBookmark card={card} />
        </div>
      ) : null}
    </li>
  );
};

const Rail = ({ rail }: { readonly rail: CursosRail }) => {
  if (rail.cards.length === 0) {
    return null;
  }
  const wide = rail.cards.length <= 3;
  return (
    <section aria-labelledby={rail.headingId} className="cb-sec">
      <header className="cb-sec__hd">
        <div>
          <h2 id={rail.headingId}>{rail.title}</h2>
          {rail.description ? <small>{rail.description}</small> : null}
        </div>
      </header>
      <div
        className={`cb-rail${rail.cards.length >= 4 ? "cb-rail--fade" : ""}`}
        style={{ "--rw": wide ? "352px" : "320px" } as CSSProperties}
      >
        <ul className="cb-rail__tr">
          {rail.cards.slice(0, 12).map((card) => (
            <CourseCard card={card} desc key={card.href} />
          ))}
        </ul>
      </div>
    </section>
  );
};

const ResumeBlock = ({
  fallback,
  resume,
}: {
  readonly fallback: CursosCourse | null;
  readonly resume: CursosResumeView | null;
}) => {
  if (resume) {
    const look = coverLook(resume.courseId);
    const started = resume.completedLessons > 0 || resume.positionSeconds > 0;
    const seconds = resume.durationSeconds;
    const fill =
      seconds && resume.positionSeconds > 0
        ? Math.min(100, (100 * resume.positionSeconds) / seconds)
        : 0;
    const percent = resume.totalLessons
      ? Math.round((100 * resume.completedLessons) / resume.totalLessons)
      : 0;
    return (
      <section aria-label="Continuar estudando" className="cb-res">
        <IntentLink
          aria-label="Abrir a aula"
          className="cb-res__cv"
          data-g={look.gradient}
          href={resume.href}
        >
          <CoverArt art={look.art} />
          <span className="cb-cv__num">{resume.lessonOrdinal}</span>
          {resume.positionSeconds > 0 && seconds ? (
            <span className="cb-res__time">
              {clock(resume.positionSeconds)} / {clock(seconds)}
            </span>
          ) : null}
          <span aria-hidden="true" className="cb-cv__bar">
            <i style={{ width: `${fill}%` }} />
          </span>
        </IntentLink>
        <div className="cb-res__bd">
          <div>
            <p className="cb-eyebrow">
              {started ? "Continuar estudando" : "Comece por aqui"}
            </p>
            <p className="cb-crumb">{resume.courseTitle}</p>
          </div>
          <h2>{resume.lessonTitle}</h2>
          <p className="cb-eyebrow">
            Módulo {resume.moduleOrdinal}
            {resume.positionSeconds > 0
              ? ` · parou em ${clock(resume.positionSeconds)}`
              : " · próxima aula"}
          </p>
          <div className="cb-prog">
            <div aria-hidden="true" className="cb-bar">
              <i style={{ width: `${percent}%` }} />
            </div>
            <b>
              {resume.completedLessons} de {resume.totalLessons} aulas
            </b>
          </div>
          <div className="cb-acts">
            <IntentLink className="cb-btn" href={resume.href}>
              <PlayIcon aria-hidden="true" fill="currentColor" size={13} />
              {started ? "Continuar aula" : "Começar curso"}
            </IntentLink>
            <IntentLink
              className="cb-btn cb-btn--ghost"
              href={resume.courseHref}
            >
              Ver curso
            </IntentLink>
          </div>
          {resume.next.length > 0 ? (
            <div className="cb-next">
              <p className="cb-eyebrow">Em seguida</p>
              {resume.next.map((item) => (
                <IntentLink
                  className="cb-nrow"
                  href={item.href}
                  key={item.href}
                >
                  <i>{item.ordinal}</i>
                  {item.title}
                  {item.minutes ? <span>{item.minutes} min</span> : null}
                </IntentLink>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  }
  if (!fallback) {
    return null;
  }
  const look = coverLook(fallback.id);
  return (
    <section aria-label="Comece por aqui" className="cb-res">
      <IntentLink
        aria-label={`Abrir ${fallback.title}`}
        className="cb-res__cv"
        data-g={look.gradient}
        href={fallback.href}
      >
        <CoverArt art={look.art} />
      </IntentLink>
      <div className="cb-res__bd">
        <p className="cb-eyebrow">Comece por aqui</p>
        <h2>{fallback.title}</h2>
        {fallback.description ? (
          <p className="cb-crumb">{fallback.description}</p>
        ) : null}
        <div className="cb-prog">
          <b>{structure(fallback)}</b>
        </div>
        <div className="cb-acts">
          <IntentLink className="cb-btn" href={fallback.href}>
            <PlayIcon aria-hidden="true" fill="currentColor" size={13} />
            Começar curso
          </IntentLink>
        </div>
      </div>
    </section>
  );
};

const TrailBlock = ({
  courses,
  trail,
}: {
  readonly courses: readonly CursosCourse[];
  readonly trail: CursosTrail;
}) => {
  const done = courses.filter(({ progress }) => progress === 100).length;
  return (
    <section aria-labelledby={`cb-trail-${trail.id}`} className="cb-trail">
      <div className="cb-trail__hd">
        <div>
          <p className="cb-eyebrow">
            Trilha · {done} de {courses.length} concluído
            {done === 1 ? "" : "s"}
          </p>
          <h3 id={`cb-trail-${trail.id}`}>{trail.title}</h3>
          {trail.description ? <p>{trail.description}</p> : null}
        </div>
      </div>
      <ol className="cb-chain">
        {courses.map((course, index) => (
          <CourseCard card={course} key={course.id} numeral={index + 1} />
        ))}
      </ol>
    </section>
  );
};

const FilterSheet = ({
  counts,
  filter,
  onClose,
  onPick,
}: {
  readonly counts: (id: CursosFilter) => number;
  readonly filter: CursosFilter;
  readonly onClose: () => void;
  readonly onPick: (id: CursosFilter) => void;
}) => {
  const first = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cb-sheetw">
      <button
        aria-label="Fechar filtro"
        className="cb-sheetbg"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-label="Filtrar cursos"
        aria-modal="true"
        className="cb-sheet"
        role="dialog"
      >
        <div aria-hidden="true" className="cb-sheet__grab" />
        <h2>Filtrar cursos</h2>
        {filters.map(({ id, label }) => (
          <button
            aria-pressed={filter === id}
            className="cb-sheet__row"
            key={id}
            onClick={() => {
              onPick(id);
              onClose();
            }}
            ref={id === filter ? first : undefined}
            type="button"
          >
            <span>{label}</span>
            <i>{counts(id)}</i>
            {filter === id ? <CheckIcon aria-hidden="true" size={18} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
};

export const CursosView = ({
  courses,
  hideResume = false,
  rails,
  resume,
  resumeRecording,
  trails,
}: {
  readonly courses: readonly CursosCourse[];
  readonly hideResume?: boolean;
  readonly rails: readonly CursosRail[];
  readonly resume: CursosResumeView | null;
  readonly resumeRecording: LearningRailCard | null;
  readonly trails: readonly CursosTrail[];
}) => {
  const [filter, setFilter] = useState<CursosFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const ordered = courses
    .map((course, index) => ({ course, index }))
    .sort((a, b) => rank(a.course) - rank(b.course) || a.index - b.index)
    .map(({ course }) => course);
  const visible = ordered.filter((course) => matchesFilter(course, filter));
  const trailed = new Map(trails.map((trail) => [trail.id, trail]));
  const counts = (id: CursosFilter) =>
    courses.filter((course) => matchesFilter(course, id)).length;
  const otherDoing = courses.find(
    (course) =>
      course.progress > 0 &&
      course.progress < 100 &&
      course.id !== resume?.courseId
  );
  const firstOpen =
    ordered.find((course) => course.progress < 100 && !course.disabled) ?? null;

  return (
    <div className="cb" data-route-content-ready="learn">
      <div className="cb-head">
        <h1>Cursos</h1>
        {courses.length >= 4 ? (
          <>
            <fieldset className="cb-seg" style={{ margin: 0 }}>
              <legend className="sr-only">Filtrar cursos</legend>
              {filters.map(({ id, label }) => (
                <button
                  aria-pressed={filter === id}
                  key={id}
                  onClick={() => setFilter(id)}
                  type="button"
                >
                  {label}
                  <i>{counts(id)}</i>
                </button>
              ))}
            </fieldset>
            <button
              aria-expanded={sheetOpen}
              aria-haspopup="dialog"
              className="cb-fbtn"
              onClick={() => setSheetOpen(true)}
              type="button"
            >
              <ListFilterIcon aria-hidden="true" size={16} />
              {filters.find(({ id }) => id === filter)?.label}
              <i>{counts(filter)}</i>
            </button>
          </>
        ) : null}
      </div>
      {sheetOpen ? (
        <FilterSheet
          counts={counts}
          filter={filter}
          onClose={closeSheet}
          onPick={setFilter}
        />
      ) : null}
      <div aria-hidden="true" className="cb-rule" />
      {hideResume ? null : <ResumeBlock fallback={firstOpen} resume={resume} />}
      {resumeRecording ? (
        <div className="cb-also">
          <div>
            <b>{resumeRecording.title}</b> · gravação em andamento
            {typeof resumeRecording.progress === "number"
              ? ` · ${resumeRecording.progress}% assistido`
              : ""}
          </div>
          <IntentLink
            className="cb-btn cb-btn--ghost cb-btn--sm"
            href={resumeRecording.href}
          >
            Continuar
          </IntentLink>
        </div>
      ) : null}
      {otherDoing ? (
        <div className="cb-also">
          <div>
            <b>{otherDoing.title}</b> · curso também em andamento ·{" "}
            {otherDoing.completedLessons} de {otherDoing.lessonCount} aulas
          </div>
          <IntentLink
            className="cb-btn cb-btn--ghost cb-btn--sm"
            href={`/cursos/${otherDoing.href.split("/")[2] ?? ""}`}
          >
            Ver curso
          </IntentLink>
        </div>
      ) : null}
      {courses.length > 0 ? (
        <section aria-labelledby="cb-all-title" className="cb-sec">
          <header className="cb-sec__hd">
            <h2 id="cb-all-title">Cursos</h2>
          </header>
          {visible.length === 0 ? (
            <div className="cb-state">
              <h2>Nenhum curso nesta seleção</h2>
              <p>Tente outra faixa de progresso.</p>
              <button
                className="cb-btn cb-btn--ghost cb-btn--sm"
                onClick={() => setFilter("all")}
                type="button"
              >
                Ver todos os cursos
              </button>
            </div>
          ) : (
            <ul className="cb-grid">
              {visible.map((course) => (
                <CourseCard card={course} desc key={course.id} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {trails.map((trail) => {
        const inTrail = visible.filter(({ trailId }) => trailId === trail.id);
        return inTrail.length > 0 && trailed.has(trail.id) ? (
          <TrailBlock courses={inTrail} key={trail.id} trail={trail} />
        ) : null;
      })}
      {rails.map((rail) => (
        <Rail key={rail.headingId} rail={rail} />
      ))}
    </div>
  );
};
