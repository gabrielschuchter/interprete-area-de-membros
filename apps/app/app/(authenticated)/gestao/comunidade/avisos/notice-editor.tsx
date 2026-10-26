"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { GestaoNoticeAudienceKind } from "@/lib/gestao-notices-domain";
import {
  AudienceStep,
  type CohortOption,
  type StudentOption,
} from "../../alunos/atribuicoes/nova/assignment-wizard-steps";
import { useGestaoDirtyRegistration } from "../../dirty-registry";
import { FormDirtyIndicator } from "../../form-dirty-indicator";
import { GestaoIcon } from "../../gestao-icon";
import { type GestaoNoticeFormState, saveGestaoNotice } from "./actions";

const initial: GestaoNoticeFormState = { error: null };
const bodyLimit = 4000;
const externalChoice = "__external";

interface LinkOption {
  readonly group: string;
  readonly href: string;
  readonly label: string;
}

export interface NoticeEditorProperties {
  readonly activeMembers: number;
  readonly cohortIds: readonly string[];
  readonly cohorts: readonly CohortOption[];
  readonly links: readonly LinkOption[];
  readonly notice: {
    readonly body: string;
    readonly endsAt: string;
    readonly href: string;
    readonly id: string;
    readonly isPinned: boolean;
    readonly mode: GestaoNoticeAudienceKind;
    readonly startsAt: string;
    readonly state: "draft" | "ended" | "published" | "scheduled";
    readonly title: string;
  } | null;
  readonly people: readonly StudentOption[];
}

const audienceModes: readonly (readonly [GestaoNoticeAudienceKind, string])[] =
  [
    ["all", "Todos os membros"],
    ["cohorts", "Turmas"],
    ["people", "Pessoas"],
    ["staff", "Equipe"],
  ];

const initialLinkChoice = (href: string, links: readonly LinkOption[]) => {
  if (!href) {
    return "";
  }
  return links.some((link) => link.href === href) ? href : externalChoice;
};

const PreviewDialog = ({
  body,
  href,
  onClose,
  title,
}: {
  readonly body: string;
  readonly href: string;
  readonly onClose: () => void;
  readonly title: string;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
    <DialogContent
      className="gk-modal gk-modal--narrow"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <div className="gk-modal-head">
        <div>
          <DialogTitle className="gk-modal-title">Como o aluno vê</DialogTitle>
          <DialogDescription className="gk-modal-sub">
            Prévia do aviso na área de membros. Nada é publicado por aqui.
          </DialogDescription>
        </div>
      </div>
      <div className="gk-modal-body">
        <article className="gk-notice-preview">
          <GestaoIcon name="bell" size={18} />
          <div>
            <strong>{title || "Sem título"}</strong>
            <p>{body || "A mensagem aparece aqui."}</p>
            {href ? <small>Abre: {href}</small> : null}
          </div>
        </article>
      </div>
      <div className="gk-modal-foot">
        <span className="gk-spacer" />
        <button className="gk-btn" onClick={onClose} type="button">
          Fechar
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

const effectiveCount = ({
  activeMembers,
  cohortIds,
  cohorts,
  mode,
  people,
}: {
  readonly activeMembers: number;
  readonly cohortIds: readonly string[];
  readonly cohorts: readonly CohortOption[];
  readonly mode: GestaoNoticeAudienceKind;
  readonly people: readonly StudentOption[];
}) => {
  if (mode === "all") {
    return activeMembers;
  }
  if (mode === "cohorts") {
    return cohorts
      .filter((cohort) => cohortIds.includes(cohort.id))
      .reduce((sum, cohort) => sum + cohort.students, 0);
  }
  return mode === "people" ? people.length : null;
};

const countSentence = (
  count: number | null,
  mode: GestaoNoticeAudienceKind,
  manyCohorts: boolean
) => {
  if (count === null) {
    return "Destinatários efetivos: a equipe de professores e administradores.";
  }
  const prefix = mode === "cohorts" && manyCohorts ? "até " : "";
  return `Destinatários efetivos: ${prefix}${count} ${count === 1 ? "membro" : "membros"}.`;
};

const stateNames = {
  draft: "Rascunho",
  ended: "Encerrado",
  published: "Publicado",
  scheduled: "Agendado",
} as const;

type EditorNotice = NonNullable<NoticeEditorProperties["notice"]>;

const MessageCard = ({
  body,
  external,
  linkChoice,
  links,
  onBody,
  onExternal,
  onLink,
  onTitle,
  title,
}: {
  readonly body: string;
  readonly external: string;
  readonly linkChoice: string;
  readonly links: readonly LinkOption[];
  readonly onBody: (value: string) => void;
  readonly onExternal: (value: string) => void;
  readonly onLink: (value: string) => void;
  readonly onTitle: (value: string) => void;
  readonly title: string;
}) => (
  <section className="gk-card gk-form-card">
    <h2>Mensagem</h2>
    <label className="gk-label">
      <span>Título *</span>
      <input
        className="gk-input"
        maxLength={180}
        name="title"
        onChange={(event) => onTitle(event.target.value)}
        placeholder="Ex.: Inscrições abertas para a Imersão"
        required
        value={title}
      />
    </label>
    <label className="gk-label">
      <span>Mensagem *</span>
      <textarea
        className="gk-input gk-textarea"
        maxLength={bodyLimit}
        name="body"
        onChange={(event) => onBody(event.target.value)}
        placeholder="Escreva o aviso em texto simples."
        required
        rows={6}
        value={body}
      />
      <small className="gk-hint">
        {body.length}/{bodyLimit} · Texto simples: é assim que os membros leem,
        na comunidade e nas notificações.
      </small>
    </label>
    <div className="gk-label">
      <label htmlFor="notice-link">Link (opcional)</label>
      <select
        className="gk-select"
        id="notice-link"
        onChange={(event) => onLink(event.target.value)}
        value={linkChoice}
      >
        <option value="">Sem link</option>
        {linkGroups.map((group) => (
          <LinkGroup group={group} key={group} links={links} />
        ))}
        <option value={externalChoice}>Endereço externo…</option>
      </select>
      {linkChoice === externalChoice ? (
        <input
          aria-label="Endereço externo"
          className="gk-input"
          maxLength={500}
          onChange={(event) => onExternal(event.target.value)}
          placeholder="https://"
          type="url"
          value={external}
        />
      ) : null}
      <small className="gk-hint">
        Escolha o destino da plataforma ou cole um endereço externo.
      </small>
    </div>
  </section>
);

const linkGroups = ["Comunidade", "Encontros", "Cursos"] as const;

const LinkGroup = ({
  group,
  links,
}: {
  readonly group: string;
  readonly links: readonly LinkOption[];
}) => {
  const items = links.filter((link) => link.group === group);
  if (items.length === 0) {
    return null;
  }
  return (
    <optgroup label={group}>
      {items.map((link) => (
        <option key={link.href} value={link.href}>
          {link.label}
        </option>
      ))}
    </optgroup>
  );
};

interface AudienceState {
  readonly cohortIds: readonly string[];
  readonly mode: GestaoNoticeAudienceKind;
  readonly people: readonly StudentOption[];
}

const AudienceCard = ({
  activeMembers,
  audience,
  cohorts,
  locked,
  onChange,
}: {
  readonly activeMembers: number;
  readonly audience: AudienceState;
  readonly cohorts: readonly CohortOption[];
  readonly locked: boolean;
  readonly onChange: (next: AudienceState) => void;
}) => {
  const count = effectiveCount({ activeMembers, cohorts, ...audience });
  const picking = audience.mode === "cohorts" || audience.mode === "people";
  return (
    <section className="gk-card gk-form-card">
      <h2>Quem vai ver</h2>
      {locked ? (
        <p className="gk-hint">
          O público não muda depois da publicação, porque as notificações já
          saíram. Para falar com outras pessoas, encerre este aviso e crie um
          novo.
        </p>
      ) : (
        <div className="gk-label">
          <span>Público</span>
          <fieldset className="gk-segmented gk-segmented--full">
            <legend className="sr-only">Público</legend>
            {audienceModes.map(([value, label]) => (
              <button
                aria-pressed={audience.mode === value}
                key={value}
                onClick={() => onChange({ ...audience, mode: value })}
                type="button"
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>
      )}
      {picking && !locked ? (
        <AudienceStep
          cohorts={cohorts}
          heading={null}
          mode={audience.mode === "cohorts" ? "cohorts" : "students"}
          onCohorts={(cohortIds) => onChange({ ...audience, cohortIds })}
          onMode={() => undefined}
          onStudents={(people) => onChange({ ...audience, people })}
          selectedCohorts={audience.cohortIds}
          selectedStudents={audience.people}
          showModes={false}
          subject="este aviso"
        />
      ) : null}
      <div className="gk-info-box">
        <GestaoIcon name="check-circle" size={18} />
        <div>
          <strong>
            {countSentence(count, audience.mode, audience.cohortIds.length > 1)}
          </strong>
          <span>
            O aviso aparece na área de membros durante o período definido.
            {audience.mode === "cohorts"
              ? " A lista é registrada na publicação: quem entrar nas turmas depois não recebe este aviso."
              : ""}
          </span>
        </div>
      </div>
    </section>
  );
};

interface PublicationState {
  readonly endsAt: string;
  readonly pinned: boolean;
  readonly scheduling: boolean;
  readonly startsAt: string;
}

const PublicationCard = ({
  existing,
  onChange,
  pending,
  publication,
}: {
  readonly existing: EditorNotice | null;
  readonly onChange: (next: PublicationState) => void;
  readonly pending: boolean;
  readonly publication: PublicationState;
}) => {
  const started = Boolean(existing && existing.state !== "draft");
  const live =
    existing?.state === "published" || existing?.state === "scheduled";
  const { scheduling } = publication;
  return (
    <section className="gk-card gk-form-card">
      <h2>Publicação</h2>
      <div className="gk-statusrow">
        <span>Estado</span>
        <span className="gk-chip" data-tone={live ? "active" : "neutral"}>
          {existing ? stateNames[existing.state] : "Rascunho"}
        </span>
      </div>
      <div className="gk-label">
        <span>Quando publicar</span>
        <fieldset className="gk-segmented gk-segmented--full">
          <legend className="sr-only">Quando publicar</legend>
          <button
            aria-pressed={!scheduling}
            onClick={() =>
              onChange({ ...publication, scheduling: false, startsAt: "" })
            }
            type="button"
          >
            Agora
          </button>
          <button
            aria-pressed={scheduling}
            onClick={() => onChange({ ...publication, scheduling: true })}
            type="button"
          >
            Agendar
          </button>
        </fieldset>
      </div>
      <div className="gk-label">
        <span>Período de exibição</span>
        <div className="gk-form-grid">
          <input
            aria-label="Início da exibição"
            className="gk-input"
            disabled={!scheduling}
            name="startsAt"
            onChange={(event) =>
              onChange({ ...publication, startsAt: event.target.value })
            }
            required={scheduling}
            type="date"
            value={scheduling ? publication.startsAt : ""}
          />
          <input
            aria-label="Fim da exibição"
            className="gk-input"
            name="endsAt"
            onChange={(event) =>
              onChange({ ...publication, endsAt: event.target.value })
            }
            type="date"
            value={publication.endsAt}
          />
        </div>
        <small className="gk-hint">
          {scheduling
            ? "Aparece a partir do início, sem notificação no dia. O fim é opcional."
            : "Aparece assim que for publicado. O fim é opcional."}
        </small>
      </div>
      <label className="gk-switch-row">
        <span>Fixar no topo dos avisos</span>
        <input
          checked={publication.pinned}
          className="gk-switch"
          name="isPinned"
          onChange={(event) =>
            onChange({ ...publication, pinned: event.target.checked })
          }
          type="checkbox"
        />
      </label>
      <div className="gk-form-actions gk-form-actions--start">
        {started ? null : (
          <button
            className="gk-btn gk-btn--primary"
            disabled={pending}
            name="intent"
            type="submit"
            value="publish"
          >
            {scheduling ? "Agendar" : "Publicar"}
          </button>
        )}
        <button
          className="gk-btn"
          disabled={pending}
          name="intent"
          type="submit"
          value={started ? "save" : "draft"}
        >
          {started ? "Salvar alterações" : "Salvar rascunho"}
        </button>
      </div>
      <p className="gk-hint">
        {live
          ? "Alterações valem para os membros assim que você salvar."
          : "Nada aparece para os alunos antes de você publicar."}
      </p>
      <Link
        className="gk-link-btn"
        href="/gestao/comunidade/avisos"
        prefetch={false}
      >
        ← Voltar aos avisos
      </Link>
    </section>
  );
};

const AudienceFields = ({ audience }: { readonly audience: AudienceState }) => (
  <>
    {audience.mode === "cohorts"
      ? audience.cohortIds.map((id) => (
          <input key={id} name="cohortId" type="hidden" value={id} />
        ))
      : null}
    {audience.mode === "people"
      ? audience.people.map((person) => (
          <input
            key={person.id}
            name="personId"
            type="hidden"
            value={person.id}
          />
        ))
      : null}
  </>
);

export const NoticeEditor = ({
  activeMembers,
  cohortIds,
  cohorts,
  links,
  notice,
  people,
}: NoticeEditorProperties) => {
  const [state, action, pending] = useActionState(saveGestaoNotice, initial);
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const choice = initialLinkChoice(notice?.href ?? "", links);
  const [linkChoice, setLinkChoice] = useState(choice);
  const [external, setExternal] = useState(
    choice === externalChoice ? (notice?.href ?? "") : ""
  );
  const [audience, setAudience] = useState<AudienceState>({
    cohortIds,
    mode: notice?.mode ?? "all",
    people,
  });
  const [publication, setPublication] = useState<PublicationState>({
    endsAt: notice?.endsAt ?? "",
    pinned: notice?.isPinned ?? false,
    scheduling: notice?.state === "scheduled",
    startsAt: notice?.startsAt ?? "",
  });
  const [previewing, setPreviewing] = useState(false);
  const [touched, setTouched] = useState(false);
  useGestaoDirtyRegistration(touched);

  const href = linkChoice === externalChoice ? external : linkChoice;
  const started = Boolean(notice && notice.state !== "draft");
  const change =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setTouched(true);
    };

  return (
    <form
      action={action}
      onChange={() => setTouched(true)}
      onSubmit={() => setTouched(false)}
    >
      {notice ? <input name="id" type="hidden" value={notice.id} /> : null}
      <input name="mode" type="hidden" value={audience.mode} />
      <input name="href" type="hidden" value={href} />
      <input
        name="when"
        type="hidden"
        value={publication.scheduling ? "schedule" : "now"}
      />
      <AudienceFields audience={audience} />

      <header className="gk-head gk-head--editor">
        <div className="gk-head-copy">
          <h1>{notice ? "Editar aviso" : "Novo aviso"}</h1>
        </div>
        <div className="gk-head-actions">
          <FormDirtyIndicator savedLabel={notice ? "Tudo salvo" : "Novo"} />
          <button
            className="gk-btn"
            onClick={() => setPreviewing(true)}
            type="button"
          >
            Pré-visualizar como aluno
          </button>
          <button
            className="gk-btn gk-btn--primary"
            disabled={pending}
            name="intent"
            type="submit"
            value={started ? "save" : "publish"}
          >
            {started ? "Salvar alterações" : "Publicar"}
          </button>
        </div>
      </header>

      {state.error ? (
        <p className="gk-error-box" role="alert">
          <GestaoIcon name="alert-circle" size={16} /> {state.error}
        </p>
      ) : null}

      <div className="gk-cols gk-cols--editor">
        <div className="gk-stack">
          <MessageCard
            body={body}
            external={external}
            linkChoice={linkChoice}
            links={links}
            onBody={change(setBody)}
            onExternal={change(setExternal)}
            onLink={change(setLinkChoice)}
            onTitle={change(setTitle)}
            title={title}
          />
          <AudienceCard
            activeMembers={activeMembers}
            audience={audience}
            cohorts={cohorts}
            locked={started}
            onChange={change(setAudience)}
          />
        </div>
        <aside className="gk-stack">
          <PublicationCard
            existing={notice}
            onChange={change(setPublication)}
            pending={pending}
            publication={publication}
          />
          <div className="gk-notice">
            <GestaoIcon name="alert-circle" size={18} />
            <div className="gk-notice-copy">
              <strong>Este aviso não envia e-mail.</strong>
              <span>
                Ele aparece na plataforma e nas notificações internas, conforme
                as preferências de cada membro.
              </span>
            </div>
          </div>
        </aside>
      </div>
      {previewing ? (
        <PreviewDialog
          body={body}
          href={href}
          onClose={() => setPreviewing(false)}
          title={title}
        />
      ) : null}
    </form>
  );
};
