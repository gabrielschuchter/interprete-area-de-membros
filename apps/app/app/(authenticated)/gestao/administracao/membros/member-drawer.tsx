"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  type ErasureBlocker,
  type ErasureCounts,
  erasureBlockerLabels,
} from "@/lib/gestao-member-erasure-labels";
import {
  memberRoleLabels,
  roleCapabilities,
  roleEffects,
} from "@/lib/gestao-members-domain";
import type { GestaoRole } from "@/lib/gestao-permissions";
import { GestaoIcon } from "../../gestao-icon";
import { changeGestaoMemberRole, eraseGestaoMemberData } from "./actions";

export interface MemberDrawerData {
  readonly email: string | null;
  readonly history: readonly { readonly at: string; readonly text: string }[];
  readonly id: string;
  readonly initials: string;
  readonly isSelf: boolean;
  readonly name: string;
  readonly role: GestaoRole;
  readonly since: string;
  readonly situationLabel: string;
}

export interface MemberErasureData {
  readonly blockers: readonly ErasureBlocker[];
  readonly canUseClerk: boolean;
  readonly confirmation: string;
  readonly counts: ErasureCounts;
}

const countLines = (counts: ErasureCounts) =>
  [
    [counts.posts, "publicação", "publicações"],
    [counts.comments, "comentário", "comentários"],
    [
      counts.commentsFromOthers,
      "comentário de outras pessoas nas publicações dele",
      "comentários de outras pessoas nas publicações dele",
    ],
    [counts.votes, "voto", "votos"],
    [counts.bookmarks, "item salvo", "itens salvos"],
    [counts.enrollments, "matrícula", "matrículas"],
    [
      counts.lessonProgress,
      "registro de progresso em aulas",
      "registros de progresso em aulas",
    ],
    [counts.cohortMemberships, "vínculo com turma", "vínculos com turmas"],
    [counts.submissions, "entrega de atividade", "entregas de atividades"],
    [counts.notes, "nota pessoal", "notas pessoais"],
  ].filter(([n]) => (n as number) > 0) as [number, string, string][];

const ConfirmErase = ({
  erasure,
  member,
  onClose,
}: {
  readonly erasure: MemberErasureData;
  readonly member: MemberDrawerData;
  readonly onClose: () => void;
}) => {
  const [typed, setTyped] = useState("");
  const lines = countLines(erasure.counts);
  const ready = typed.trim().toLowerCase() === erasure.confirmation;
  return (
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <form action={eraseGestaoMemberData}>
          <input name="memberId" type="hidden" value={member.id} />
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Apagar os dados de {member.name}?
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                Isso não pode ser desfeito.
              </DialogDescription>
            </div>
            <button
              aria-label="Fechar"
              className="gk-modal-close"
              onClick={onClose}
              type="button"
            >
              <GestaoIcon name="x" size={18} />
            </button>
          </div>
          <div className="gk-modal-body">
            <ul className="gk-effects">
              <li data-gain="false">
                <GestaoIcon name="x" size={16} /> O perfil, as preferências e
                tudo o que a pessoa criou saem do banco.
              </li>
              {lines.map(([n, one, many]) => (
                <li data-gain="false" key={one}>
                  <GestaoIcon name="x" size={16} /> {n} {n === 1 ? one : many}
                </li>
              ))}
              <li data-gain="true">
                <GestaoIcon name="check" size={16} /> O registro desta ação fica
                na auditoria.
              </li>
            </ul>
            <label className="gk-switch-row" htmlFor="erase-clerk">
              <span>
                Apagar também a conta de login (Clerk)
                <small>
                  {erasure.canUseClerk
                    ? "Sem isso, a pessoa ainda consegue entrar e uma conta nova é criada no primeiro acesso."
                    : "Esta conta não tem login no Clerk."}
                </small>
              </span>
              <input
                disabled={!erasure.canUseClerk}
                id="erase-clerk"
                name="clerk"
                type="checkbox"
              />
            </label>
            <div className="gk-label">
              <label htmlFor="erase-confirmation">
                Para confirmar, digite <strong>{erasure.confirmation}</strong>
              </label>
              <input
                autoComplete="off"
                className="gk-input"
                id="erase-confirmation"
                name="confirmation"
                onChange={(event) => setTyped(event.target.value)}
                value={typed}
              />
            </div>
          </div>
          <div className="gk-modal-foot">
            <button
              className="gk-btn gk-btn--primary"
              disabled={!ready}
              type="submit"
            >
              Apagar definitivamente
            </button>
            <button className="gk-btn" onClick={onClose} type="button">
              Cancelar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const roles = ["MEMBER", "TEACHER", "ADMIN"] as const;

const ConfirmRole = ({
  member,
  next,
  onClose,
}: {
  readonly member: MemberDrawerData;
  readonly next: GestaoRole;
  readonly onClose: () => void;
}) => {
  const effects = roleEffects(member.role, next);
  return (
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <form action={changeGestaoMemberRole}>
          <input name="memberId" type="hidden" value={member.id} />
          <input name="from" type="hidden" value={member.role} />
          <input name="role" type="hidden" value={next} />
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Alterar o papel de {member.name}?
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                De <strong>{memberRoleLabels[member.role]}</strong> para{" "}
                <strong>{memberRoleLabels[next]}</strong>.
              </DialogDescription>
            </div>
            <button
              aria-label="Fechar"
              className="gk-modal-close"
              onClick={onClose}
              type="button"
            >
              <GestaoIcon name="x" size={18} />
            </button>
          </div>
          <div className="gk-modal-body">
            <ul className="gk-effects">
              {effects.gained.map((label) => (
                <li data-gain="true" key={label}>
                  <GestaoIcon name="check" size={16} /> Passa a poder:{" "}
                  {label.toLowerCase()}
                </li>
              ))}
              {effects.lost.map((label) => (
                <li data-gain="false" key={label}>
                  <GestaoIcon name="x" size={16} /> Deixa de poder:{" "}
                  {label.toLowerCase()}
                </li>
              ))}
              {effects.gained.length + effects.lost.length === 0 ? (
                <li data-gain="true">
                  <GestaoIcon name="check" size={16} /> As capacidades não
                  mudam.
                </li>
              ) : null}
            </ul>
            <div className="gk-info-box">
              <GestaoIcon name="check-circle" size={20} />
              <div>
                <strong>A alteração será registrada no histórico.</strong>
                <span>Os acessos que ele já tem como aluno continuam.</span>
              </div>
            </div>
          </div>
          <div className="gk-modal-foot">
            <button className="gk-btn gk-btn--primary" type="submit">
              Alterar papel
            </button>
            <button className="gk-btn" onClick={onClose} type="button">
              Cancelar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const MemberDrawer = ({
  closeHref,
  erasure,
  member,
}: {
  readonly closeHref: string;
  readonly erasure: MemberErasureData | null;
  readonly member: MemberDrawerData;
}) => {
  const router = useRouter();
  const [role, setRole] = useState<GestaoRole>(member.role);
  const [confirming, setConfirming] = useState(false);
  const [erasing, setErasing] = useState(false);
  const close = () => router.push(closeHref);
  return (
    <>
      <Dialog onOpenChange={(open) => (open ? null : close())} open>
        <DialogContent
          className="gk-drawer"
          overlayClassName="gk-modal-overlay"
          showCloseButton={false}
        >
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                {member.name}
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                Conta desde {member.since}
              </DialogDescription>
            </div>
            <button
              aria-label="Fechar"
              className="gk-modal-close"
              onClick={close}
              type="button"
            >
              <GestaoIcon name="x" size={18} />
            </button>
          </div>
          <div className="gk-drawer-body">
            <div className="gk-person">
              <span aria-hidden="true" className="gk-avatar gk-avatar--xl">
                {member.initials}
              </span>
              <div>
                <span className="gk-qsub">{member.email ?? "Sem e-mail"}</span>
                <div className="gk-chiprow">
                  <span className="gk-rolechip" data-role={member.role}>
                    {memberRoleLabels[member.role]}
                  </span>
                  <span className="gk-chip" data-tone="active">
                    {member.situationLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="gk-label">
              <label htmlFor="member-role">Papel</label>
              <div className="gk-rolepicker">
                <select
                  className="gk-select"
                  disabled={member.isSelf}
                  id="member-role"
                  onChange={(event) =>
                    setRole(event.target.value as GestaoRole)
                  }
                  value={role}
                >
                  {roles.map((value) => (
                    <option key={value} value={value}>
                      {memberRoleLabels[value]}
                    </option>
                  ))}
                </select>
                <button
                  className="gk-btn gk-btn--primary gk-btn--wide"
                  disabled={member.isSelf || role === member.role}
                  onClick={() => setConfirming(true)}
                  type="button"
                >
                  Alterar
                </button>
              </div>
              <small className="gk-hint">
                {member.isSelf
                  ? "Você não altera o próprio papel. Peça a outro administrador."
                  : "A mudança pede confirmação e fica registrada."}
              </small>
            </div>
            <section aria-label="Capacidades">
              <p className="gk-eyebrow">Capacidades do papel</p>
              {roleCapabilities.map((capability) => {
                const enabled = roleEffects(
                  "MEMBER",
                  member.role
                ).gained.includes(capability.label);
                return (
                  <div className="gk-switch-row" key={capability.action}>
                    <span>
                      {capability.label}
                      <small>{capability.description}</small>
                    </span>
                    <span
                      aria-label={enabled ? "Habilitado" : "Não habilitado"}
                      className="gk-capstate"
                      data-on={enabled}
                      role="img"
                    >
                      {enabled ? "Sim" : "Não"}
                    </span>
                  </div>
                );
              })}
              <small className="gk-hint">
                As capacidades seguem o papel e são aplicadas no servidor a cada
                ação. Ajustes por pessoa ainda não existem.
              </small>
            </section>
            <section aria-label="Histórico">
              <p className="gk-eyebrow">Histórico</p>
              {member.history.length === 0 ? (
                <small className="gk-hint">Nenhuma alteração registrada.</small>
              ) : (
                <ul className="gk-history">
                  {member.history.map((entry) => (
                    <li key={`${entry.at}-${entry.text}`}>
                      {entry.at} · {entry.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {erasure ? (
              <section aria-label="Apagar dados">
                <p className="gk-eyebrow">Apagar dados</p>
                {erasure.blockers.length > 0 ? (
                  <ul className="gk-history">
                    {erasure.blockers.map((blocker) => (
                      <li key={blocker}>{erasureBlockerLabels[blocker]}</li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <small className="gk-hint">
                      Remove a pessoa e tudo o que ela produziu, por exemplo
                      perfis criados em testes. Pede confirmação digitada.
                    </small>
                    <button
                      className="gk-btn gk-btn--wide"
                      onClick={() => setErasing(true)}
                      type="button"
                    >
                      Apagar dados do membro
                    </button>
                  </>
                )}
              </section>
            ) : null}
          </div>
          <div className="gk-drawer-foot">
            <a
              className="gk-btn gk-btn--wide"
              href={`/gestao/administracao/acessos?membro=${encodeURIComponent(member.id)}`}
            >
              Ver acessos
            </a>
            <a
              className="gk-btn gk-btn--wide"
              href={`/gestao/alunos/perfil/${encodeURIComponent(member.id)}`}
            >
              Ver perfil pedagógico
            </a>
          </div>
        </DialogContent>
      </Dialog>
      {erasing && erasure ? (
        <ConfirmErase
          erasure={erasure}
          member={member}
          onClose={() => setErasing(false)}
        />
      ) : null}
      {confirming ? (
        <ConfirmRole
          member={member}
          next={role}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
};
