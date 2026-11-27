import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import {
  addContentLinkAction,
  removeContentLinkAction,
} from "@/app/(authenticated)/gestao/ensino/vinculos/actions";
import { getLinkedContent, getLinkOptions } from "@/lib/content-links";
import {
  type LinkRef,
  type LinkSide,
  linkSideLabels,
} from "@/lib/content-links-model";

interface LinkOptionItem {
  readonly id: string;
  readonly label: string;
}

const help: Record<LinkSide, string> = {
  lesson:
    "Sugestões para o aluno praticar depois da aula. Aparecem em “Continue praticando”, ao final dela.",
  exerciseList:
    "Aulas e materiais que combinam com esta lista. Aparecem para o aluno em “Continue praticando”, na aula vinculada.",
  libraryItem:
    "Aulas e listas que combinam com este material. Aparecem para o aluno em “Continue praticando”, na aula vinculada.",
};

const AddForm = ({
  options,
  source,
  target,
}: {
  readonly options: readonly { id: string; label: string }[];
  readonly source: LinkRef;
  readonly target: LinkSide;
}) => {
  const fieldId = `content-link-${source.side}-${target}`;
  return (
    <details className="gl-lesson-associate">
      <summary>
        <PlusIcon aria-hidden="true" /> {linkSideLabels[target]}
      </summary>
      <form action={addContentLinkAction}>
        <input name="sourceSide" type="hidden" value={source.side} />
        <input name="sourceId" type="hidden" value={source.id} />
        <input name="targetSide" type="hidden" value={target} />
        <label htmlFor={fieldId}>
          Vincular {linkSideLabels[target].toLowerCase()}
        </label>
        <select defaultValue="" id={fieldId} name="targetId" required>
          <option disabled value="">
            {options.length > 0 ? "Escolha…" : "Nada disponível para vincular"}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          className="gk-btn gk-btn--primary gk-btn--sm"
          disabled={options.length === 0}
          type="submit"
        >
          Vincular
        </button>
      </form>
    </details>
  );
};

const RemoveButton = ({
  label,
  linkId,
}: {
  readonly label: string;
  readonly linkId: string;
}) => (
  <form action={removeContentLinkAction}>
    <input name="linkId" type="hidden" value={linkId} />
    <button aria-label={`Desvincular ${label}`} type="submit">
      <Trash2Icon aria-hidden="true" />
    </button>
  </form>
);

const Chip = ({
  href,
  kind,
  linkId,
  note,
  title,
}: {
  readonly href: string;
  readonly kind: string;
  readonly linkId: string | null;
  readonly note?: string;
  readonly title: string;
}) => (
  <li>
    <span className="gl-link-kind">{kind}</span>
    <Link href={href} prefetch={false}>
      {title}
    </Link>
    {note ? <span className="gl-link-note">{note}</span> : null}
    {linkId ? <RemoveButton label={title} linkId={linkId} /> : null}
  </li>
);

const materialNote = (item: {
  readonly legacy: boolean;
  readonly published: boolean;
}) => {
  if (item.legacy) {
    return "vinculado no cadastro do material";
  }
  return item.published ? undefined : "não publicado";
};

/**
 * "Conteúdos relacionados": o professor vincula aulas, listas de exercícios e
 * materiais entre si, de qualquer um dos três editores. O vínculo vale nos
 * dois sentidos e é só uma sugestão de estudo para o aluno.
 */
export const ContentLinksSection = async ({
  source,
}: {
  readonly source: LinkRef;
}) => {
  const [linked, options] = await Promise.all([
    getLinkedContent(source),
    getLinkOptions(),
  ]);
  const taken = {
    exerciseList: new Set(linked.exerciseLists.map(({ id }) => id)),
    lesson: new Set(linked.lessons.map(({ id }) => id)),
    libraryItem: new Set(linked.libraryItems.map(({ id }) => id)),
  };
  const targets = (["lesson", "exerciseList", "libraryItem"] as const).filter(
    (side) => side !== source.side
  );
  const optionsBySide: Record<LinkSide, readonly LinkOptionItem[]> = {
    exerciseList: options.exerciseLists,
    lesson: options.lessons,
    libraryItem: options.libraryItems,
  };
  const optionsFor = (side: LinkSide) =>
    optionsBySide[side].filter(({ id }) => !taken[side].has(id));
  const total =
    linked.lessons.length +
    linked.exerciseLists.length +
    linked.libraryItems.length;

  return (
    <section
      aria-labelledby="content-links-title"
      className="gl-lesson-card gl-lesson-materials gl-content-links"
    >
      <header>
        <h2 id="content-links-title">Conteúdos relacionados</h2>
        <div className="gl-content-links-add">
          {targets.map((side) => (
            <AddForm
              key={side}
              options={optionsFor(side)}
              source={source}
              target={side}
            />
          ))}
        </div>
      </header>
      <p className="gl-lesson-empty">{help[source.side]}</p>
      {total > 0 ? (
        <ul className="gl-lesson-chips">
          {linked.lessons.map((lesson) => (
            <Chip
              href={`/gestao/ensino/cursos/${lesson.courseId}/aulas/${lesson.id}`}
              key={`l-${lesson.id}`}
              kind="Aula"
              linkId={lesson.legacy ? null : lesson.linkId}
              note={
                lesson.legacy ? "vinculada no cadastro do material" : undefined
              }
              title={lesson.label}
            />
          ))}
          {linked.exerciseLists.map((list) => (
            <Chip
              href={`/gestao/ensino/exercicios/${list.id}`}
              key={`e-${list.id}`}
              kind="Lista"
              linkId={list.linkId}
              note={list.published ? undefined : "não publicada"}
              title={list.title}
            />
          ))}
          {linked.libraryItems.map((item) => (
            <Chip
              href={`/gestao/ensino/biblioteca/${item.id}`}
              key={`m-${item.id}`}
              kind="Material"
              linkId={item.linkId}
              note={materialNote(item)}
              title={item.title}
            />
          ))}
        </ul>
      ) : (
        <p className="gl-lesson-empty">Nada vinculado ainda.</p>
      )}
    </section>
  );
};
