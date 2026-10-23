"use client";

import {
  ArrowLeftIcon,
  ChevronDownIcon,
  LockIcon,
  PlayIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { setRoomLessonCompleted } from "@/app/(authenticated)/cursos/room-actions";
import { CourseCover, clock } from "./cover";

interface CourseViewLesson {
  readonly completed: boolean;
  readonly description: string | null;
  readonly href: string;
  readonly id: string;
  readonly minutes: number | null;
  readonly ordinal: number;
  readonly positionSeconds: number | null;
  readonly progressPercent: number | null;
  readonly releaseLabel: string | null;
  readonly title: string;
}

interface CourseViewModule {
  readonly completedCount: number;
  readonly id: string;
  readonly lessons: readonly CourseViewLesson[];
  readonly numeral: string;
  readonly open: boolean;
  readonly title: string;
}

export interface CourseViewData {
  readonly completedLessons: number;
  readonly continueHref: string | null;
  readonly continueLabel: string;
  readonly continueStoppedAt: number | null;
  readonly coverUrl: string | null;
  readonly currentLessonId: string | null;
  readonly description: string | null;
  readonly eyebrow: string;
  readonly highlightLessonId: string | null;
  readonly hoursLabel: string | null;
  readonly id: string;
  readonly modules: readonly CourseViewModule[];
  readonly percentage: number;
  readonly reviewHref: string | null;
  readonly title: string;
  readonly totalLessons: number;
}

const LessonRow = ({
  current,
  flash,
  lesson,
  onToggle,
  pending,
  rowId,
}: {
  readonly current: boolean;
  readonly flash: boolean;
  readonly lesson: CourseViewLesson;
  readonly onToggle: (lesson: CourseViewLesson, completed: boolean) => void;
  readonly pending: boolean;
  readonly rowId: string;
}) => {
  const locked = lesson.releaseLabel !== null;
  let sub = lesson.minutes ? `${lesson.minutes} min` : "";
  if (locked) {
    sub = lesson.releaseLabel ?? "";
  }
  const body = (
    <>
      <span aria-hidden="true" className="cb-thumb" data-g="1">
        <span className="cb-thumb__n">{lesson.ordinal}</span>
        {locked ? (
          <span className="cb-thumb__lk">
            <LockIcon size={15} />
          </span>
        ) : null}
        {lesson.progressPercent === null ? null : (
          <span className="cb-thumb__bar">
            <i style={{ width: `${lesson.progressPercent}%` }} />
          </span>
        )}
      </span>
      <span className="cb-li__t">
        <b>{lesson.title}</b>
        <span>
          {sub}
          {current && !locked ? (
            <>
              {sub ? " · " : ""}
              <em>assistindo</em>
              {lesson.positionSeconds
                ? ` · parou em ${clock(lesson.positionSeconds)}`
                : ""}
            </>
          ) : null}
        </span>
      </span>
    </>
  );
  return (
    <li
      aria-current={current ? "true" : undefined}
      className="cb-li"
      data-current={current ? "true" : undefined}
      data-flash={flash ? "true" : undefined}
      data-off={locked ? "true" : undefined}
      id={rowId}
    >
      <label className="cb-li__ck">
        <input
          aria-label={`Marcar aula ${lesson.ordinal} como feita`}
          checked={lesson.completed}
          disabled={locked || pending}
          onChange={(event) => onToggle(lesson, event.target.checked)}
          type="checkbox"
        />
      </label>
      {locked ? (
        <span className="cb-li__a">{body}</span>
      ) : (
        <Link className="cb-li__a" href={lesson.href}>
          {body}
        </Link>
      )}
    </li>
  );
};

export const CourseView = ({ data }: { readonly data: CourseViewData }) => {
  const [done, setDone] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(data.modules.filter((m) => m.open).map((m) => m.id))
  );
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<{
    readonly lesson: CourseViewLesson;
    readonly message: string;
  } | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data.highlightLessonId) {
      return;
    }
    document
      .getElementById(`cb-lesson-${data.highlightLessonId}`)
      ?.scrollIntoView({ block: "center" });
  }, [data.highlightLessonId]);

  const isDone = (lesson: CourseViewLesson) =>
    done.get(lesson.id) ?? lesson.completed;
  const modules = data.modules.map((module) => ({
    ...module,
    completedCount: module.lessons.filter(isDone).length,
  }));
  const completed = modules.reduce((n, m) => n + m.completedCount, 0);
  const percent = data.totalLessons
    ? Math.round((100 * completed) / data.totalLessons)
    : 0;
  const currentModule =
    modules.find((m) => m.lessons.some((l) => l.id === data.currentLessonId)) ??
    modules[0];
  const many = modules.length >= 6;

  const toggle = (lesson: CourseViewLesson, value: boolean, undo = false) => {
    setDone((map) => new Map(map).set(lesson.id, value));
    setPending((set) => new Set(set).add(lesson.id));
    startTransition(async () => {
      const result = await setRoomLessonCompleted({
        completed: value,
        lessonId: lesson.id,
      });
      setPending((set) => {
        const next = new Set(set);
        next.delete(lesson.id);
        return next;
      });
      if (!result.ok) {
        setDone((map) => new Map(map).set(lesson.id, !value));
        return;
      }
      if (!undo) {
        if (timer.current) {
          clearTimeout(timer.current);
        }
        setToast({
          lesson,
          message: value ? "Aula marcada como feita" : "Aula reaberta",
        });
        timer.current = setTimeout(() => setToast(null), 5000);
      }
    });
  };

  const toggleModule = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const jump = (id: string) => {
    setOpen((current) => new Set(current).add(id));
    requestAnimationFrame(() =>
      document
        .getElementById(`cb-mod-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const summary = modules.map((module) => (
    <a
      aria-current={module.id === currentModule?.id ? "true" : undefined}
      className="cb-sum__a"
      href={`#cb-mod-${module.id}`}
      key={module.id}
      onClick={(event) => {
        event.preventDefault();
        jump(module.id);
      }}
    >
      <i>{module.numeral}</i>
      {module.title}
      <em>
        {module.completedCount}/{module.lessons.length}
      </em>
    </a>
  ));
  const finished = data.continueHref === null;
  const started = completed > 0;

  return (
    <div className="cb" data-route-content-ready="course">
      <Link className="cb-back" href="/cursos">
        <ArrowLeftIcon aria-hidden="true" size={16} />
        Cursos
      </Link>
      <div className="cb-cp__hero">
        <CourseCover
          barPercent={percent}
          coverUrl={data.coverUrl}
          id={data.id}
          kind="Curso"
          title={data.title}
        />
        <div className="cb-cp__ti">
          <h1>{data.title}</h1>
          {data.description ? (
            <p className="cb-lead">{data.description}</p>
          ) : null}
          <div className="cb-facts">
            <span>{modules.length} módulos</span>
            <span>{data.totalLessons} aulas</span>
            {data.hoursLabel ? <span>{data.hoursLabel}</span> : null}
          </div>
          {started || finished ? (
            <div className="cb-prog">
              <div aria-hidden="true" className="cb-bar">
                <i style={{ width: `${percent}%` }} />
              </div>
              <b>
                {completed} de {data.totalLessons} aulas
                {finished ? " · concluído" : ""}
              </b>
            </div>
          ) : null}
          <div className="cb-cp__cta">
            {(finished ? data.reviewHref : data.continueHref) ? (
              <Link
                className="cb-btn"
                href={(finished ? data.reviewHref : data.continueHref) ?? "#"}
              >
                <PlayIcon aria-hidden="true" fill="currentColor" size={13} />
                {finished ? "Rever do início" : data.continueLabel}
              </Link>
            ) : null}
            {data.continueStoppedAt && !finished ? (
              <span className="cb-after">
                Parou em {clock(data.continueStoppedAt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="cb-rule" />
      {modules.length === 0 ? (
        <div className="cb-state">
          <h2>Ainda não há módulos publicados</h2>
          <p>
            O conteúdo aparece aqui quando a equipe publicar o primeiro módulo.
          </p>
        </div>
      ) : (
        <div className="cb-cp__cols" data-single={modules.length <= 2}>
          <div>
            <div className="cb-listhd">
              <h2>Conteúdo do curso</h2>
              {many ? (
                <div>
                  <button
                    className="cb-mini"
                    onClick={() => setOpen(new Set(modules.map((m) => m.id)))}
                    type="button"
                  >
                    Expandir tudo
                  </button>
                  <button
                    className="cb-mini"
                    onClick={() => currentModule && jump(currentModule.id)}
                    type="button"
                  >
                    Ir para o módulo atual
                  </button>
                </div>
              ) : null}
            </div>
            {modules.map((module) => {
              const expanded = open.has(module.id);
              return (
                <div
                  className="cb-mod"
                  data-open={expanded}
                  id={`cb-mod-${module.id}`}
                  key={module.id}
                >
                  <button
                    aria-controls={`cb-mod-body-${module.id}`}
                    aria-expanded={expanded}
                    className="cb-mod__hd"
                    onClick={() => toggleModule(module.id)}
                    type="button"
                  >
                    <span className="cb-mod__ti">
                      <i className="cb-mod__n">{module.numeral}</i>
                      {module.title}
                    </span>
                    {module.id === currentModule?.id && !finished ? (
                      <span className="cb-mod__here">você está aqui</span>
                    ) : null}
                    <span className="cb-mod__ct">
                      {module.completedCount}/{module.lessons.length}
                    </span>
                    <ChevronDownIcon aria-hidden="true" size={18} />
                  </button>
                  {expanded ? (
                    <ul className="cb-mod__bd" id={`cb-mod-body-${module.id}`}>
                      {module.lessons.length === 0 ? (
                        <li className="cb-after" style={{ padding: 12 }}>
                          Nenhuma aula publicada neste módulo.
                        </li>
                      ) : (
                        module.lessons.map((lesson) => (
                          <LessonRow
                            current={lesson.id === data.currentLessonId}
                            flash={lesson.id === data.highlightLessonId}
                            key={lesson.id}
                            lesson={{ ...lesson, completed: isDone(lesson) }}
                            onToggle={toggle}
                            pending={pending.has(lesson.id)}
                            rowId={`cb-lesson-${lesson.id}`}
                          />
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          {modules.length > 2 ? (
            <aside aria-label="Sumário" className="cb-sum">
              <details className="cb-sumd">
                <summary>
                  Sumário · módulo{" "}
                  {modules.findIndex((m) => m.id === currentModule?.id) + 1} de{" "}
                  {modules.length}
                </summary>
                <div className="cb-sum__l">{summary}</div>
              </details>
              <div className="cb-sumfull">
                <h3>Sumário</h3>
                <div className="cb-sum__l">{summary}</div>
              </div>
            </aside>
          ) : null}
        </div>
      )}
      {toast ? (
        <output className="cb-toast">
          {toast.message}
          <button
            onClick={() => {
              const target = toast.lesson;
              setToast(null);
              toggle(target, !isDone(target), true);
            }}
            type="button"
          >
            Desfazer
          </button>
        </output>
      ) : null}
    </div>
  );
};
