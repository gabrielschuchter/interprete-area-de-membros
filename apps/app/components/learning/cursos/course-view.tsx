import { CheckIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RoomTemple } from "../room/room-art";

interface CourseViewLesson {
  readonly completed: boolean;
  readonly description: string | null;
  readonly href: string;
  readonly id: string;
  readonly ordinal: number;
  readonly title: string;
}

interface CourseViewModule {
  readonly completedCount: number;
  readonly id: string;
  readonly lessons: readonly CourseViewLesson[];
  readonly open: boolean;
  readonly title: string;
}

export interface CourseViewData {
  readonly completedLessons: number;
  readonly continueHref: string | null;
  readonly continueLabel: string;
  readonly coverUrl: string | null;
  readonly description: string | null;
  readonly eyebrow: string;
  readonly highlightLessonId: string | null;
  readonly modules: readonly CourseViewModule[];
  readonly percentage: number;
  readonly title: string;
  readonly totalLessons: number;
}

const LessonRow = ({
  highlighted,
  lesson,
}: {
  readonly highlighted: boolean;
  readonly lesson: CourseViewLesson;
}) => (
  <li
    className="cursos-lesson"
    data-done={lesson.completed ? "true" : undefined}
    data-highlight={highlighted ? "true" : undefined}
  >
    <Link className="cursos-lesson__link" href={lesson.href}>
      <span aria-hidden="true" className="cursos-lesson__thumb">
        <RoomTemple />
        <span className="cursos-lesson__n">{lesson.ordinal}</span>
      </span>
      <span className="cursos-lesson__text">
        <span className="cursos-lesson__title">{lesson.title}</span>
        {lesson.description ? (
          <span className="cursos-lesson__desc">{lesson.description}</span>
        ) : null}
      </span>
      {lesson.completed ? (
        <span className="cursos-lesson__done">
          <CheckIcon aria-hidden="true" size={16} />
          <span className="sr-only">Aula concluída</span>
        </span>
      ) : null}
    </Link>
  </li>
);

export const CourseView = ({ data }: { readonly data: CourseViewData }) => (
  <div className="cursos cursos--course">
    <header className="cursos-course__head">
      {data.coverUrl ? (
        <div className="cursos-course__cover">
          <Image
            alt=""
            fill
            sizes="(min-width: 1024px) 320px, 100vw"
            src={data.coverUrl}
            unoptimized
          />
          <span aria-hidden="true" className="cursos-meander" />
        </div>
      ) : null}
      <div className="cursos-course__intro">
        <p className="cursos-eyebrow">{data.eyebrow}</p>
        <h1>{data.title}</h1>
        {data.description ? <p>{data.description}</p> : null}
      </div>
    </header>
    <div className="cursos-course__body">
      <section aria-labelledby="cursos-modules-title">
        <h2 className="sr-only" id="cursos-modules-title">
          Módulos e aulas
        </h2>
        {data.modules.length === 0 ? (
          <p className="cursos-empty">
            Ainda não há módulos publicados. O conteúdo aparece aqui quando a
            equipe publicar o primeiro módulo.
          </p>
        ) : (
          <div className="cursos-modules">
            {data.modules.map((module, index) => (
              <details
                className={`cursos-module${index > 0 ? "cursos-module--next" : ""}`}
                key={module.id}
                open={module.open}
              >
                <summary
                  className="cursos-module__head"
                  id={`module-${module.id}`}
                >
                  <span className="cursos-module__title">{module.title}</span>
                  <span className="cursos-mono">
                    {module.completedCount}/{module.lessons.length}
                  </span>
                </summary>
                {module.lessons.length === 0 ? (
                  <p className="cursos-empty">
                    Nenhuma aula publicada neste módulo.
                  </p>
                ) : (
                  <ul className="cursos-lessons">
                    {module.lessons.map((lesson) => (
                      <LessonRow
                        highlighted={lesson.id === data.highlightLessonId}
                        key={lesson.id}
                        lesson={lesson}
                      />
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>
        )}
      </section>
      <aside aria-label="Seu progresso" className="cursos-summary">
        <p className="cursos-eyebrow">Seu progresso</p>
        <p className="cursos-summary__value">{data.percentage}%</p>
        <div aria-hidden="true" className="cursos-summary__bar">
          <span
            className="cursos-summary__fill"
            style={{ width: `${data.percentage}%` }}
          />
        </div>
        <p className="cursos-mono">
          {data.completedLessons} de {data.totalLessons} aulas
        </p>
        {data.continueHref ? (
          <Link className="cursos-button" href={data.continueHref}>
            {data.continueLabel}
          </Link>
        ) : null}
      </aside>
    </div>
  </div>
);
