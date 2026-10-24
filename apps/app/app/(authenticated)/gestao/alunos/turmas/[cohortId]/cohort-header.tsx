import Link from "next/link";
import type { GestaoCohortDetail } from "@/lib/gestao-cohorts";
import { GestaoCrumbTail } from "../../../gestao-crumbs";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "America/Sao_Paulo",
});
const tabs = [
  ["visao", "Visão geral", ""],
  ["alunos", "Alunos", "/alunos"],
  ["conteudo", "Conteúdo e cronograma", "/conteudo"],
  ["calendario", "Encontros e calendário", "/calendario"],
  ["atividades", "Atividades", "/atividades"],
  ["configuracoes", "Configurações", "/configuracoes"],
] as const;
const labels = {
  ACTIVE: "Em andamento",
  NOT_STARTED: "Não iniciada",
  ENDED: "Encerrada",
  ARCHIVED: "Arquivada",
} as const;

export const GestaoCohortHeader = ({
  cohort,
  activeTab,
}: {
  readonly cohort: GestaoCohortDetail;
  readonly activeTab: (typeof tabs)[number][0];
}) => {
  const responsible = cohort.teachers
    .map(({ member }) => member.displayName ?? "Professor")
    .join(", ");
  return (
    <>
      <GestaoCrumbTail items={[{ label: cohort.name }]} />
      <header className="gt-detail-heading">
        <div>
          <div className="gt-detail-title">
            <h1>{cohort.name}</h1>
            <span
              className={`gt-status-pill gt-status-${cohort.status.toLowerCase()}`}
            >
              {labels[cohort.status]}
            </span>
          </div>
          <p>
            {dateFormat.format(cohort.startsAt)}
            {cohort.endsAt
              ? ` a ${dateFormat.format(cohort.endsAt)}`
              : " · sem data final"}{" "}
            · Responsável: {responsible || "não atribuído"}
          </p>
        </div>
        <div className="gt-detail-actions">
          <Link
            className="gk-btn gk-btn--primary"
            href={`/gestao/alunos/turmas/${cohort.id}/alunos?adicionar=existentes`}
          >
            Adicionar alunos
          </Link>
        </div>
      </header>
      <nav aria-label="Seções da turma" className="gt-cohort-tabs">
        {tabs.map(([key, label, suffix]) => (
          <Link
            aria-current={activeTab === key ? "page" : undefined}
            className="gt-cohort-tab"
            data-active={String(activeTab === key)}
            href={`/gestao/alunos/turmas/${cohort.id}${suffix}`}
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
};
