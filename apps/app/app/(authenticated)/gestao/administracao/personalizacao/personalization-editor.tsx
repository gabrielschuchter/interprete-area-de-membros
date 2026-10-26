"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useActionState, useMemo, useRef, useState } from "react";
import {
  type CursosBlockConfig,
  cursosBlockMeta,
  maxBlockSubtitle,
  maxBlockTitle,
  maxNoteText,
  type PortalNoteConfig,
} from "@/lib/personalization-domain";
import { useGestaoDirtyRegistration } from "../../dirty-registry";
import { GestaoIcon } from "../../gestao-icon";
import { GestaoSwitch } from "../../gestao-switch";
import { type PublishState, publishGestaoPersonalization } from "./actions";
import {
  PersonalizationPreview,
  type PreviewDevice,
} from "./personalization-preview";

export interface PersonalizationDraft {
  readonly blocks: readonly CursosBlockConfig[];
  readonly note: PortalNoteConfig;
  readonly recordingsExperienceV2: boolean;
  readonly showLearnNavigation: boolean;
}

const idleState: PublishState = { error: null };

const move = <T,>(items: readonly T[], from: number, to: number) => {
  if (to < 0 || to >= items.length || from === to) {
    return [...items];
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) {
    next.splice(to, 0, item);
  }
  return next;
};

const BlockEditDialog = ({
  block,
  onClose,
  onSave,
}: {
  readonly block: CursosBlockConfig;
  readonly onClose: () => void;
  readonly onSave: (title: string | null, subtitle: string | null) => void;
}) => {
  const meta = cursosBlockMeta[block.id];
  const [title, setTitle] = useState(block.title ?? "");
  const [subtitle, setSubtitle] = useState(block.subtitle ?? "");
  return (
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <div className="gk-modal-head">
          <div>
            <DialogTitle className="gk-modal-title">
              Editar “{meta.label}”
            </DialogTitle>
            <DialogDescription className="gk-modal-sub">
              O texto aparece para todos os alunos depois de publicar.
            </DialogDescription>
          </div>
        </div>
        <div className="gk-modal-body">
          <label className="gk-label">
            <span>Título</span>
            <input
              className="gk-input"
              maxLength={maxBlockTitle}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={meta.defaultTitle}
              value={title}
            />
          </label>
          <label className="gk-label">
            <span>
              Descrição <em>opcional</em>
            </span>
            <textarea
              className="gk-input gk-textarea"
              maxLength={maxBlockSubtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              rows={3}
              value={subtitle}
            />
          </label>
        </div>
        <div className="gk-modal-foot">
          <span className="gk-spacer" />
          <button className="gk-btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="gk-btn gk-btn--primary"
            onClick={() =>
              onSave(title.trim() || null, subtitle.trim() || null)
            }
            type="button"
          >
            Aplicar ao rascunho
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ConfirmDialog = ({
  names,
  onCancel,
  onConfirm,
}: {
  readonly names: readonly string[];
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onCancel())} open>
    <DialogContent
      className="gk-modal gk-modal--narrow"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <div className="gk-modal-head">
        <div>
          <DialogTitle className="gk-modal-title">
            Esconder {names.length === 1 ? "este bloco" : "estes blocos"}?
          </DialogTitle>
          <DialogDescription className="gk-modal-sub">
            {names.join(", ")} deixa de aparecer para todos os alunos. Nada é
            apagado: dá para ligar de novo a qualquer momento.
          </DialogDescription>
        </div>
      </div>
      <div className="gk-modal-foot">
        <span className="gk-spacer" />
        <button className="gk-btn" onClick={onCancel} type="button">
          Voltar
        </button>
        <button
          className="gk-btn gk-btn--primary"
          onClick={onConfirm}
          type="button"
        >
          Publicar mesmo assim
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

const BlockRow = ({
  block,
  index,
  onDrop,
  onEdit,
  onMove,
  onToggle,
  setDragFrom,
}: {
  readonly block: CursosBlockConfig;
  readonly index: number;
  readonly onDrop: (to: number) => void;
  readonly onEdit: () => void;
  readonly onMove: (delta: number) => void;
  readonly onToggle: (value: boolean) => void;
  readonly setDragFrom: (index: number | null) => void;
}) => {
  const meta = cursosBlockMeta[block.id];
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: arrastar é um atalho; o reordenar por teclado fica na alça.
    <li
      className="gk-blockrow"
      draggable={!meta.fixedTop}
      onDragEnd={() => setDragFrom(null)}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={() => setDragFrom(index)}
      onDrop={() => onDrop(index)}
    >
      {meta.fixedTop ? (
        <span
          aria-hidden="true"
          className="gk-blockrow-grip gk-blockrow-grip--off"
        />
      ) : (
        <button
          aria-label={`Reordenar ${meta.label}. Use as setas para cima e para baixo.`}
          className="gk-blockrow-grip"
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              onMove(event.key === "ArrowUp" ? -1 : 1);
            }
          }}
          type="button"
        >
          <GestaoIcon name="grip" size={16} />
        </button>
      )}
      <span className="gk-blockrow-copy">
        <strong>{block.title ?? meta.label}</strong>
        <small>{block.subtitle ?? meta.description}</small>
      </span>
      {meta.editable ? (
        <button
          aria-label={`Editar ${meta.label}`}
          className="gk-iconbtn"
          onClick={onEdit}
          type="button"
        >
          <GestaoIcon name="pencil" size={16} />
        </button>
      ) : null}
      <input
        aria-checked={block.enabled}
        aria-label={`Exibir ${meta.label}`}
        checked={block.enabled}
        className="gk-switch"
        onChange={(event) => onToggle(event.target.checked)}
        role="switch"
        type="checkbox"
      />
    </li>
  );
};

export const PersonalizationEditor = ({
  initial,
}: {
  readonly initial: PersonalizationDraft;
}) => {
  const [draft, setDraft] = useState<PersonalizationDraft>(initial);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(
    publishGestaoPersonalization,
    idleState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial]
  );
  const newlyOff = draft.blocks.filter((block) => {
    const before = initial.blocks.find((item) => item.id === block.id);
    return before?.enabled && !block.enabled;
  });

  useGestaoDirtyRegistration(dirty);

  const patchBlock = (id: string, patch: Partial<CursosBlockConfig>) =>
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id ? { ...block, ...patch } : block
      ),
    }));
  const reorder = (from: number, to: number) =>
    setDraft((current) => {
      const target = current.blocks[to];
      const source = current.blocks[from];
      if (
        !(target && source) ||
        cursosBlockMeta[target.id].fixedTop ||
        cursosBlockMeta[source.id].fixedTop
      ) {
        return current;
      }
      return { ...current, blocks: move(current.blocks, from, to) };
    });
  const editingBlock = draft.blocks.find((block) => block.id === editing);
  const preview = (
    <PersonalizationPreview
      blocks={draft.blocks}
      device={device}
      note={draft.note}
      showLearn={draft.showLearnNavigation}
    />
  );
  const deviceToggle = (
    <fieldset aria-label="Dispositivo da prévia" className="gk-segmented">
      {(["desktop", "mobile"] as const).map((item) => (
        <button
          aria-pressed={device === item}
          key={item}
          onClick={() => setDevice(item)}
          type="button"
        >
          {item === "desktop" ? "Desktop" : "Celular"}
        </button>
      ))}
    </fieldset>
  );

  return (
    <form action={formAction} className="gk-person-grid" ref={formRef}>
      <input name="payload" type="hidden" value={JSON.stringify(draft)} />
      <div className="gk-person-main">
        <section className="gk-card">
          <h2 className="gk-card-title">Recursos disponíveis</h2>
          <GestaoSwitch
            checked={draft.recordingsExperienceV2}
            description="Ativa a experiência de encontros anteriores. Os arquivos continuam preservados mesmo desligada."
            label="Arquivo de gravações"
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                recordingsExperienceV2: value,
              }))
            }
          />
          <GestaoSwitch
            checked={draft.showLearnNavigation}
            description="Mostra Cursos na navegação apenas quando houver conteúdo gravado publicado e acessível."
            label="Cursos na navegação"
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                showLearnNavigation: value,
              }))
            }
          />
        </section>

        <section className="gk-card">
          <h2 className="gk-card-title">Cursos (página do aluno)</h2>
          <p className="gk-hint">
            Arraste para reordenar. Desligue um bloco só quando ele não fizer
            sentido nesta fase. A página continua funcionando se todos forem
            desligados.
          </p>
          <ul className="gk-blocklist">
            {draft.blocks.map((block, index) => (
              <BlockRow
                block={block}
                index={index}
                key={block.id}
                onDrop={(to) => {
                  if (dragFrom !== null) {
                    reorder(dragFrom, to);
                  }
                  setDragFrom(null);
                }}
                onEdit={() => setEditing(block.id)}
                onMove={(delta) => reorder(index, index + delta)}
                onToggle={(value) => patchBlock(block.id, { enabled: value })}
                setDragFrom={setDragFrom}
              />
            ))}
          </ul>
        </section>

        <section className="gk-card">
          <h2 className="gk-card-title">Portal de entrada</h2>
          <GestaoSwitch
            checked={draft.note.enabled}
            description="Uma única nota curta sob a pergunta do portal, por exemplo “Encontro hoje, 19h30.”."
            label="Mostrar uma nota de aviso no portal"
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                note: { ...current.note, enabled: value },
              }))
            }
          />
          {draft.note.enabled ? (
            <>
              <div className="gk-label">
                <span>Qual aviso aparece</span>
                <fieldset className="gk-segmented gk-segmented--full">
                  {(
                    [
                      ["auto", "O encontro mais próximo (automático)"],
                      ["manual", "Escolher manualmente"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      aria-pressed={draft.note.mode === mode}
                      key={mode}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          note: { ...current.note, mode },
                        }))
                      }
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
              </div>
              {draft.note.mode === "manual" ? (
                <label className="gk-label">
                  <span>Texto da nota</span>
                  <input
                    className="gk-input"
                    maxLength={maxNoteText}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        note: { ...current.note, text: event.target.value },
                      }))
                    }
                    placeholder="Ex.: Recesso na próxima semana."
                    value={draft.note.text}
                  />
                  <small className="gk-hint">
                    {draft.note.text.length}/{maxNoteText}
                  </small>
                </label>
              ) : (
                <p className="gk-hint">
                  Mostra o próximo encontro publicado, só quando é hoje ou
                  amanhã. Fora disso, nenhuma nota aparece.
                </p>
              )}
            </>
          ) : null}
        </section>
      </div>

      <aside className="gk-person-side">
        <div className="gk-person-side-head">
          <span className="gk-eyebrow">Prévia como aluno</span>
          {deviceToggle}
        </div>
        {preview}
      </aside>

      {dirty || state.error ? (
        <output className="gk-savebar">
          <span className="gk-savebar-msg">
            <GestaoIcon name="alert-circle" size={16} />
            {state.error ?? "Alterações não publicadas"}
          </span>
          <span className="gk-spacer" />
          <button
            className="gk-link-btn"
            onClick={() => setDraft(initial)}
            type="button"
          >
            Descartar
          </button>
          <button
            className="gk-btn"
            onClick={() => setPreviewOpen(true)}
            type="button"
          >
            Pré-visualizar
          </button>
          <button
            className="gk-btn gk-btn--primary"
            disabled={pending || !dirty}
            onClick={() =>
              newlyOff.length > 0
                ? setConfirming(true)
                : formRef.current?.requestSubmit()
            }
            type="button"
          >
            {pending ? "Publicando…" : "Publicar alterações"}
          </button>
        </output>
      ) : null}

      {editingBlock ? (
        <BlockEditDialog
          block={editingBlock}
          onClose={() => setEditing(null)}
          onSave={(title, subtitle) => {
            patchBlock(editingBlock.id, { subtitle, title });
            setEditing(null);
          }}
        />
      ) : null}
      {confirming ? (
        <ConfirmDialog
          names={newlyOff.map((block) => cursosBlockMeta[block.id].label)}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            formRef.current?.requestSubmit();
          }}
        />
      ) : null}
      {previewOpen ? (
        <Dialog onOpenChange={setPreviewOpen} open>
          <DialogContent
            className="gk-modal gk-modal--wide"
            overlayClassName="gk-modal-overlay"
            showCloseButton={false}
          >
            <div className="gk-modal-head">
              <div>
                <DialogTitle className="gk-modal-title">
                  Prévia como aluno
                </DialogTitle>
                <DialogDescription className="gk-modal-sub">
                  Isto é o rascunho. Nada vale até publicar.
                </DialogDescription>
              </div>
              {deviceToggle}
            </div>
            <div className="gk-modal-body">{preview}</div>
            <div className="gk-modal-foot">
              <span className="gk-spacer" />
              <button
                className="gk-btn"
                onClick={() => setPreviewOpen(false)}
                type="button"
              >
                Voltar a editar
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </form>
  );
};
