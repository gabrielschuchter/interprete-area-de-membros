import {
  type CursosBlockConfig,
  cursosBlockMeta,
  type PortalNoteConfig,
} from "@/lib/personalization-domain";

export type PreviewDevice = "desktop" | "mobile";

const sampleNote = "Encontro hoje, 19h30.";

export const noteForPreview = (note: PortalNoteConfig) => {
  if (!note.enabled) {
    return null;
  }
  return note.mode === "manual" ? note.text || null : sampleNote;
};

const Rail = ({
  subtitle,
  title,
}: {
  subtitle: string | null;
  title: string;
}) => (
  <div className="gk-prev-rail">
    <strong>{title}</strong>
    {subtitle ? <small>{subtitle}</small> : null}
    <div aria-hidden="true" className="gk-prev-cards">
      <span />
      <span />
      <span />
    </div>
  </div>
);

export const PersonalizationPreview = ({
  blocks,
  device,
  note,
  showLearn,
}: {
  readonly blocks: readonly CursosBlockConfig[];
  readonly device: PreviewDevice;
  readonly note: PortalNoteConfig;
  readonly showLearn: boolean;
}) => {
  const portalNote = noteForPreview(note);
  return (
    <div className="gk-prev" data-device={device}>
      <section aria-label="Prévia do portal" className="gk-prev-page">
        <p className="gk-prev-eyebrow">Portal</p>
        <p className="gk-prev-title">Por qual caminho você quer seguir hoje?</p>
        {portalNote ? <p className="gk-prev-note">{portalNote}</p> : null}
      </section>
      <section aria-label="Prévia de Cursos" className="gk-prev-page">
        <p className="gk-prev-eyebrow">
          {showLearn ? "Cursos" : "Cursos (fora da navegação)"}
        </p>
        {blocks
          .filter((block) => block.enabled)
          .map((block) => {
            const meta = cursosBlockMeta[block.id];
            if (block.id === "resume") {
              return (
                <div className="gk-prev-hero" key={block.id}>
                  <small>{meta.defaultTitle}</small>
                  <strong>Aula 5 · Formulando a pergunta</strong>
                </div>
              );
            }
            return (
              <Rail
                key={block.id}
                subtitle={block.subtitle}
                title={block.title ?? meta.defaultTitle}
              />
            );
          })}
        {blocks.every((block) => !block.enabled) ? (
          <p className="gk-prev-empty">
            Sem blocos extras. A lista de cursos continua aparecendo.
          </p>
        ) : null}
      </section>
      <p className="gk-prev-foot">
        Conteúdo de exemplo, só para a ordem e os textos.
      </p>
    </div>
  );
};
