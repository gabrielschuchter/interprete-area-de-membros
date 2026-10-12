import { ActivitySubmissionStatus } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { CorrectionFeedbackForm } from "@/components/gestao/correction-feedback-form";
import { isReviewForCurrentSubmission } from "@/lib/gestao-activity-review-domain";
import { correctionResultMessages } from "@/lib/gestao-correction-contract";
import type { getGestaoCorrectionQueue } from "@/lib/gestao-corrections";
import { memberAssetUrl } from "@/lib/member-storage";

type CorrectionQueueData = Awaited<ReturnType<typeof getGestaoCorrectionQueue>>;
type CorrectionSubmission = NonNullable<
  CorrectionQueueData["selectedSubmission"]
>;

const statusLabels: Record<GestaoCorrectionStatus, string> = {
  ALL: "Todas",
  PENDING: "Pendentes",
  REVIEWED: "Corrigidas",
};

const whitespaceRegex = /\s+/;
type GestaoCorrectionStatus = CorrectionQueueData["status"];

const displayName = (submission: CorrectionSubmission) =>
  submission.member.displayName ?? submission.member.email ?? "Aluno";

const initials = (name: string) =>
  name
    .split(whitespaceRegex)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "I";

const dateLabel = (value: Date | null, fallback: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(value)
    : fallback;

const safeScores = (value: unknown): Readonly<Record<string, number>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, score]) =>
        typeof score === "number" &&
        Number.isInteger(score) &&
        score >= 0 &&
        score <= 10
    )
  );
};

const currentReview = (submission: CorrectionSubmission) => {
  const draft = submission.feedbackDraft;
  if (
    draft &&
    isReviewForCurrentSubmission({
      reviewAt: draft.updatedAt,
      reviewRubricVersion: draft.rubricVersion,
      submissionAt: submission.submittedAt,
      submissionRubricVersion: submission.rubricVersion,
    })
  ) {
    return draft;
  }
  const feedback = submission.feedback;
  if (
    feedback?.submittedAt &&
    isReviewForCurrentSubmission({
      reviewAt: feedback.submittedAt,
      reviewRubricVersion: feedback.rubricVersion,
      submissionAt: submission.submittedAt,
      submissionRubricVersion: submission.rubricVersion,
    })
  ) {
    return feedback;
  }
  return null;
};

const buildQueueHref = (
  basePath: string,
  input: {
    readonly cohortId?: string;
    readonly page?: number;
    readonly query?: string;
    readonly selectedSubmissionId?: string;
    readonly status?: GestaoCorrectionStatus;
  }
) => {
  const params = new URLSearchParams();
  if (input.status && input.status !== "PENDING") {
    params.set("estado", input.status);
  }
  if (input.cohortId) {
    params.set("turma", input.cohortId);
  }
  if (input.query) {
    params.set("q", input.query);
  }
  if (input.page && input.page > 1) {
    params.set("pagina", String(input.page));
  }
  if (input.selectedSubmissionId) {
    params.set("entrega", input.selectedSubmissionId);
  }
  const suffix = params.toString();
  return `${basePath}${suffix ? `?${suffix}` : ""}`;
};

const statusResultHref = (
  basePath: string,
  data: CorrectionQueueData,
  status: GestaoCorrectionStatus
) =>
  buildQueueHref(basePath, {
    cohortId: data.cohortId,
    query: data.query,
    status,
  });

const QueueRow = ({
  basePath,
  data,
  submission,
}: {
  readonly basePath: string;
  readonly data: CorrectionQueueData;
  readonly submission: (typeof data.submissions)[number];
}) => {
  const name = displayName(submission);
  const reviewed = submission.status === ActivitySubmissionStatus.REVIEWED;
  return (
    <Link
      aria-current={
        data.selectedSubmission?.id === submission.id ? "true" : undefined
      }
      className={`gc-queue-row ${data.selectedSubmission?.id === submission.id ? "is-selected" : ""}`}
      href={buildQueueHref(basePath, {
        cohortId: data.cohortId,
        page: data.page,
        query: data.query,
        selectedSubmissionId: submission.id,
        status: data.status,
      })}
      key={submission.id}
      prefetch={false}
    >
      <span aria-hidden="true" className="gc-avatar">
        {initials(name)}
      </span>
      <span className="gc-queue-row-copy">
        <strong>{name}</strong>
        <span>{submission.activity.title}</span>
        <small>
          {reviewed ? "Corrigida" : "Enviada"}{" "}
          {dateLabel(submission.submittedAt, "sem data")}
        </small>
      </span>
      <span
        className={`gc-status-pill ${reviewed ? "is-reviewed" : "is-pending"}`}
      >
        {reviewed ? "Corrigida" : "Pendente"}
      </span>
    </Link>
  );
};

const queueCount = (
  data: CorrectionQueueData,
  status: GestaoCorrectionStatus
) => {
  if (status === "PENDING") {
    return data.counts.pending;
  }
  if (status === "REVIEWED") {
    return data.counts.reviewed;
  }
  return data.counts.all;
};

const QueuePagination = ({
  basePath,
  data,
}: {
  readonly basePath: string;
  readonly data: CorrectionQueueData;
}) => (
  <nav aria-label="Paginação da fila" className="gc-pagination">
    <Link
      aria-disabled={data.page <= 1}
      href={buildQueueHref(basePath, {
        cohortId: data.cohortId,
        page: Math.max(1, data.page - 1),
        query: data.query,
        status: data.status,
      })}
      prefetch={false}
    >
      <ChevronLeftIcon aria-hidden="true" /> Anterior
    </Link>
    <span>
      {data.page} / {data.pageCount}
    </span>
    <Link
      aria-disabled={data.page >= data.pageCount}
      href={buildQueueHref(basePath, {
        cohortId: data.cohortId,
        page: Math.min(data.pageCount, data.page + 1),
        query: data.query,
        status: data.status,
      })}
      prefetch={false}
    >
      Próxima <ChevronRightIcon aria-hidden="true" />
    </Link>
  </nav>
);

const QueuePanel = ({
  basePath,
  data,
}: {
  readonly basePath: string;
  readonly data: CorrectionQueueData;
}) => (
  <aside aria-label="Fila de entregas" className="gc-queue-panel">
    <nav aria-label="Filtrar correções" className="gc-queue-tabs">
      {(["PENDING", "REVIEWED", "ALL"] as const).map((status) => (
        <Link
          aria-current={data.status === status ? "page" : undefined}
          className={data.status === status ? "is-active" : ""}
          href={statusResultHref(basePath, data, status)}
          key={status}
          prefetch={false}
        >
          {statusLabels[status]}
          {status === "PENDING" ? <> · {queueCount(data, status)}</> : null}
        </Link>
      ))}
    </nav>
    <form action={basePath} className="gc-filters" method="get">
      <input name="estado" type="hidden" value={data.status} />
      <label htmlFor="gc-cohort-filter">
        <span className="sr-only">Filtrar por turma</span>
        <select defaultValue={data.cohortId} id="gc-cohort-filter" name="turma">
          <option value="">Todas as turmas</option>
          {data.cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </select>
      </label>
      <label className="gc-search" htmlFor="gc-search-input">
        <SearchIcon aria-hidden="true" />
        <input
          defaultValue={data.query}
          id="gc-search-input"
          maxLength={120}
          name="q"
          placeholder="Buscar aluno ou atividade"
        />
      </label>
      <Button size="sm" type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
    <div className="gc-queue-list">
      {data.submissions.length ? (
        data.submissions.map((submission) => (
          <QueueRow
            basePath={basePath}
            data={data}
            key={submission.id}
            submission={submission}
          />
        ))
      ) : (
        <p className="gc-empty-queue">
          {data.query || data.cohortId
            ? "Nenhuma entrega corresponde a estes filtros."
            : "Nenhuma entrega nesta fila por enquanto."}
        </p>
      )}
    </div>
    {data.pageCount > 1 ? (
      <QueuePagination basePath={basePath} data={data} />
    ) : null}
  </aside>
);

const SubmissionPanel = ({
  basePath,
  data,
}: {
  readonly basePath: string;
  readonly data: CorrectionQueueData;
}) => {
  const selected = data.selectedSubmission;
  if (!selected) {
    return (
      <article aria-label="Entrega selecionada" className="gc-submission-panel">
        <div className="gc-empty-detail">
          <h2>Escolha uma entrega</h2>
          <p>
            Selecione uma pessoa na fila para ler a resposta e preparar o
            feedback.
          </p>
        </div>
      </article>
    );
  }

  return (
    <article aria-label="Entrega selecionada" className="gc-submission-panel">
      <Link
        className="gc-back-to-queue"
        href={buildQueueHref(basePath, {
          cohortId: data.cohortId,
          page: data.page,
          query: data.query,
          status: data.status,
        })}
        prefetch={false}
      >
        <ArrowLeftIcon aria-hidden="true" /> Voltar à fila
      </Link>
      <header className="gc-submission-header">
        <span aria-hidden="true" className="gc-avatar gc-avatar-large">
          {initials(displayName(selected))}
        </span>
        <div>
          <strong>{displayName(selected)}</strong>
          <span>Enviada {dateLabel(selected.submittedAt, "sem data")}</span>
        </div>
        <span
          className={`gc-status-pill ${selected.status === ActivitySubmissionStatus.REVIEWED ? "is-reviewed" : "is-pending"}`}
        >
          {selected.status === ActivitySubmissionStatus.REVIEWED
            ? "Corrigida"
            : "Pendente"}
        </span>
      </header>
      <div className="gc-submission-content">
        <p className="gestao-eyebrow">Atividade</p>
        <h2>{selected.activity.title}</h2>
        <p className="gc-prompt">{selected.activity.prompt}</p>
        <div className="gc-response">
          <p className="gestao-eyebrow">Resposta do aluno</p>
          <p>{selected.content}</p>
          {selected.attachmentPath ? (
            <a
              href={memberAssetUrl(selected.attachmentPath)}
              rel="noreferrer"
              target="_blank"
            >
              {selected.attachmentName ?? "Abrir arquivo enviado"}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
};

const FeedbackPanel = ({
  basePath,
  data,
}: {
  readonly basePath: string;
  readonly data: CorrectionQueueData;
}) => {
  const selected = data.selectedSubmission;
  if (!selected) {
    return (
      <aside aria-label="Feedback e rubrica" className="gc-feedback-panel">
        <div className="gc-empty-detail gc-empty-feedback">
          <h2>Seu feedback</h2>
          <p>
            O comentário e as notas aparecem aqui quando você selecionar uma
            entrega.
          </p>
        </div>
      </aside>
    );
  }

  const reviewValues = currentReview(selected);
  const draftCurrent =
    Boolean(selected.feedbackDraft) && reviewValues === selected.feedbackDraft;
  const returnTo = buildQueueHref(basePath, {
    cohortId: data.cohortId,
    page: data.page,
    query: data.query,
    selectedSubmissionId: selected.id,
    status: data.status,
  });

  return (
    <aside aria-label="Feedback e rubrica" className="gc-feedback-panel">
      <CorrectionFeedbackForm
        content={reviewValues?.content ?? ""}
        criteria={data.criteria}
        draftCurrent={draftCurrent}
        draftVersion={selected.feedbackDraft?.version ?? 0}
        feedbackVersion={selected.feedback?.version ?? 0}
        initialScores={safeScores(reviewValues?.criteriaScores)}
        returnTo={returnTo}
        submissionId={selected.id}
        submissionUpdatedAt={selected.updatedAt.toISOString()}
        submittedAt={selected.submittedAt.toISOString()}
      />
    </aside>
  );
};

export const GestaoCorrectionQueue = ({
  basePath,
  data,
  result,
}: {
  readonly basePath: string;
  readonly data: CorrectionQueueData;
  readonly result?: string;
}) => {
  const resultMessage =
    result && result in correctionResultMessages
      ? correctionResultMessages[
          result as keyof typeof correctionResultMessages
        ]
      : null;
  return (
    <section className="gestao-page-content gc-page">
      <header className="gc-page-heading">
        <div>
          <p className="gestao-eyebrow">
            Gestão <span aria-hidden="true">›</span> Alunos{" "}
            <span aria-hidden="true">›</span> Correções
          </p>
          <h1>Correções</h1>
          <p>
            Fila de entregas aguardando avaliação, com contexto e feedback no
            mesmo lugar.
          </p>
        </div>
        {data.activity ? (
          <Button asChild variant="outline">
            <Link
              href={["/gestao/ensino/atividades", data.activity.id].join("/")}
              prefetch={false}
            >
              <ArrowLeftIcon aria-hidden="true" /> Atividade
            </Link>
          </Button>
        ) : null}
      </header>
      {resultMessage ? (
        <output className="gc-result">{resultMessage}</output>
      ) : null}
      <div
        className="gc-layout"
        data-mobile-detail={data.selectedSubmissionExplicit ? "true" : "false"}
      >
        <QueuePanel basePath={basePath} data={data} />
        <SubmissionPanel basePath={basePath} data={data} />
        <FeedbackPanel basePath={basePath} data={data} />
      </div>
    </section>
  );
};
