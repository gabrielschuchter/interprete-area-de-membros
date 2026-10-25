import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { getGestaoActivityEditorData } from "@/lib/gestao-activities";
import { FormDirtyIndicator } from "../../form-dirty-indicator";
import { GestaoCrumbTail } from "../../gestao-crumbs";
import { GestaoIcon } from "../../gestao-icon";
import {
  remindGestaoActivityCohort,
  saveGestaoActivity,
  setGestaoActivityStatus,
} from "./actions";
import { ActivityMemberPicker, RubricCriteriaEditor } from "./activity-editors";

type EditorData = Awaited<ReturnType<typeof getGestaoActivityEditorData>>;

const dateTimeLocal = (value: Date | null) => {
  if (!value) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

const resultMessages: Record<string, string> = {
  salva: "Alterações salvas.",
  criada: "Atividade criada como rascunho.",
  publicada: "Atividade publicada.",
  conflito:
    "Outra alteração foi salva primeiro. Atualize a página e revise a versão atual.",
  "dados-invalidos": "Revise os campos e tente novamente.",
  criteria: "Os pesos dos critérios precisam somar 100%.",
  "lembretes-enviados":
    "Lembrete registrado para envio aos alunos pendentes desta turma.",
  "sem-pendentes": "Todos os alunos elegíveis desta turma já entregaram.",
  "sem-elegiveis":
    "Nenhum aluno desta turma tem acesso vigente para receber o lembrete.",
  "limite-lembrete":
    "Esta turma excede o limite de envio; nenhum lembrete foi enviado.",
  "due-date": "Informe um prazo futuro para publicar.",
  "destinatarios-invalidos":
    "Escolha ao menos uma turma, aluno ou conteúdo com acesso definido.",
  "turmas-invalidas":
    "Uma das turmas deixou de estar disponível para seu perfil.",
  "alunos-invalidos":
    "Revise a seleção de alunos: alguns não pertencem às suas turmas ativas.",
  "referencias-invalidas": "Confira o curso, a aula e o material relacionados.",
  "slug-existente": "Este endereço já está sendo usado por outra atividade.",
};

const statusNames = {
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
} as const;

const deliveryOptions = [
  ["TEXT", "Texto"],
  ["FILE", "Arquivo"],
  ["TEXT_AND_FILE", "Texto e arquivo"],
] as const;

const relativeLabel = (value: Date) => {
  const days = Math.floor((Date.now() - value.getTime()) / 86_400_000);
  if (days <= 0) {
    return "hoje";
  }
  return days === 1 ? "ontem" : `há ${days} dias`;
};

const ActivityMainColumn = ({
  data,
  activity,
}: {
  readonly data: EditorData;
  readonly activity: EditorData["activity"];
}) => (
  <div className="gk-stack">
    <section className="gk-card gk-card--wide">
      <h2>Atividade</h2>
      <div className="gk-label">
        <label htmlFor="activity-title">Título *</label>
        <input
          className="gk-input"
          defaultValue={activity?.title ?? ""}
          id="activity-title"
          maxLength={180}
          name="title"
          required
        />
      </div>
      <div className="gk-label">
        <label htmlFor="activity-prompt">Pergunta *</label>
        <textarea
          className="gk-input gk-textarea"
          defaultValue={activity?.prompt ?? ""}
          id="activity-prompt"
          maxLength={20_000}
          name="prompt"
          required
          rows={6}
        />
      </div>
      <div className="gk-label">
        <label htmlFor="activity-instructions">Instruções</label>
        <textarea
          className="gk-input gk-textarea"
          defaultValue={activity?.instructions ?? ""}
          id="activity-instructions"
          maxLength={20_000}
          name="instructions"
          rows={4}
        />
      </div>
      <fieldset className="gk-fmt">
        <legend>Formato da entrega</legend>
        <div>
          {deliveryOptions.map(([value, label]) => (
            <label key={value}>
              <input
                defaultChecked={(activity?.deliveryKind ?? "TEXT") === value}
                name="deliveryKind"
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <details className="gk-details">
        <summary>Endereço da atividade</summary>
        <input
          autoComplete="off"
          className="gk-input"
          defaultValue={activity?.slug ?? ""}
          id="activity-slug"
          maxLength={120}
          name="slug"
          placeholder="Gerado a partir do título"
        />
      </details>
    </section>

    <section className="gk-card gk-card--wide">
      <RubricCriteriaEditor initial={activity?.rubricCriteria} />
    </section>
    <section className="gk-card gk-card--wide">
      <h2>Materiais de apoio</h2>
      <div className="gk-label">
        <label htmlFor="activity-library-item">Leitura relacionada</label>
        <span className="gk-field gk-field--full">
          <select
            className="gk-select gk-select--plain"
            defaultValue={activity?.relatedLibraryItemId ?? ""}
            id="activity-library-item"
            name="relatedLibraryItemId"
          >
            <option value="">Nenhum material</option>
            {data.libraryItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </span>
        <small className="gk-hint">
          O aluno encontra o material junto da atividade. Novos materiais são
          cadastrados na Biblioteca.
        </small>
      </div>
    </section>
  </div>
);

const ActivityAudienceCard = ({
  data,
  activity,
  cohortIds,
}: {
  readonly data: EditorData;
  readonly activity: EditorData["activity"];
  readonly cohortIds: ReadonlySet<string>;
}) => (
  <section className="gk-card">
    <h2>Destinatários</h2>
    <p className="gk-hint">
      Combine turmas e alunos individuais. Acesso duplicado permanece único.
    </p>
    <fieldset className="gk-cohort-picker">
      <legend>Turmas</legend>
      {data.cohorts.length ? (
        data.cohorts.map((cohort) => (
          <label className="gk-cohort-option" key={cohort.id}>
            <input
              defaultChecked={cohortIds.has(cohort.id)}
              name="cohortIds"
              type="checkbox"
              value={cohort.id}
            />
            <span>
              <strong>{cohort.name}</strong>
              <small>
                {cohort.activeMemberCount} alunos ·{" "}
                {cohort.lateJoinPolicy === "ALL_ACTIVE"
                  ? "novos alunos também recebem"
                  : "somente alunos presentes no envio"}
              </small>
            </span>
          </label>
        ))
      ) : (
        <p className="gk-hint">Nenhuma turma disponível para seu perfil.</p>
      )}
    </fieldset>
    <details className="gk-details" open={Boolean(data.selectedMembers.length)}>
      <summary>Adicionar alunos individualmente</summary>
      <ActivityMemberPicker initialSelected={data.selectedMembers} />
    </details>
    <div className="gk-label">
      <label htmlFor="activity-course">Ou associe a um curso ou aula</label>
      <span className="gk-field gk-field--full">
        <select
          className="gk-select gk-select--plain"
          defaultValue={activity?.courseId ?? ""}
          id="activity-course"
          name="courseId"
        >
          <option value="">Nenhum curso</option>
          {data.courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </span>
    </div>
    <div className="gk-label">
      <label htmlFor="activity-lesson">Aula relacionada</label>
      <span className="gk-field gk-field--full">
        <select
          className="gk-select gk-select--plain"
          defaultValue={activity?.lessonId ?? ""}
          id="activity-lesson"
          name="lessonId"
        >
          <option value="">Nenhuma aula</option>
          {data.courses.flatMap((course) =>
            course.modules.flatMap((module) =>
              module.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {course.title} · {lesson.title}
                </option>
              ))
            )
          )}
        </select>
      </span>
    </div>
  </section>
);

const ActivityPublishingCard = ({
  activity,
}: {
  readonly activity: EditorData["activity"];
}) => {
  const status = activity?.status ?? "DRAFT";
  return (
    <section className="gk-card">
      <header className="gk-card-head">
        <h2>Publicação</h2>
        <span
          className="gk-chip"
          data-tone={status === "PUBLISHED" ? "active" : "neutral"}
        >
          {statusNames[status]}
        </span>
      </header>
      <div className="gk-label">
        <label htmlFor="activity-due-at">Prazo de entrega</label>
        <input
          className="gk-input"
          defaultValue={dateTimeLocal(activity?.dueAt ?? null)}
          id="activity-due-at"
          name="dueAt"
          type="datetime-local"
        />
        <small className="gk-hint">
          {activity?.dueAt
            ? "O prazo vale para todos os destinatários."
            : "Informe um prazo futuro para publicar a atividade."}
        </small>
      </div>
      {status === "PUBLISHED" ? null : (
        <button
          className="gk-btn gk-btn--primary"
          name="intent"
          type="submit"
          value="publish"
        >
          Publicar
        </button>
      )}
      <button className="gk-btn" name="intent" type="submit" value="save">
        {activity ? "Salvar alterações" : "Salvar rascunho"}
      </button>
      <p className="gk-hint">
        {status === "PUBLISHED"
          ? "Alterações valem para os alunos assim que você salvar."
          : "Nada aparece para os alunos antes de você publicar."}
      </p>
    </section>
  );
};

const ActivityEditorHeader = ({
  activity,
}: {
  readonly activity: EditorData["activity"];
}) => {
  const status = activity?.status ?? "DRAFT";
  return (
    <header className="gk-head gk-head--editor">
      <div className="gk-head-copy">
        <h1>{activity ? "Editar atividade" : "Nova atividade"}</h1>
        <p>
          {statusNames[status]}
          {activity ? ` · criada ${relativeLabel(activity.createdAt)}` : ""}
        </p>
      </div>
      <div className="gk-head-actions">
        <FormDirtyIndicator savedLabel={activity ? "Tudo salvo" : "Novo"} />
        {activity ? (
          <Link
            className="gk-btn"
            href={`/gestao/ensino/atividades/${activity.id}/previa`}
            prefetch={false}
          >
            Pré-visualizar como aluno
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="gk-btn"
            data-disabled="true"
            title="Salve o rascunho para pré-visualizar"
          >
            Pré-visualizar como aluno
          </span>
        )}
        {status === "PUBLISHED" ? (
          <button
            className="gk-btn gk-btn--primary"
            name="intent"
            type="submit"
            value="save"
          >
            Salvar alterações
          </button>
        ) : (
          <button
            className="gk-btn gk-btn--primary"
            name="intent"
            type="submit"
            value="publish"
          >
            Publicar
          </button>
        )}
      </div>
    </header>
  );
};

export const GestaoActivityEditor = async ({
  activityId,
  defaultCohortId,
  result,
}: {
  readonly activityId?: string;
  readonly defaultCohortId?: string;
  readonly result?: string;
}) => {
  const data: EditorData = await getGestaoActivityEditorData(activityId);
  const { activity } = data;
  if (activityId && !activity) {
    notFound();
  }
  const cohortIds = new Set(
    activity?.cohortTargets.map(({ cohortId }) => cohortId) ??
      (defaultCohortId &&
      data.cohorts.some((cohort) => cohort.id === defaultCohortId)
        ? [defaultCohortId]
        : [])
  );
  const resultMessage = result ? resultMessages[result] : null;
  const failed = Boolean(
    result &&
      !["salva", "criada", "publicada", "lembretes-enviados"].includes(result)
  );

  return (
    <section className="gt-page gk-activities">
      <GestaoCrumbTail
        items={[{ label: activity?.title ?? "Nova atividade" }]}
      />
      {resultMessage ? (
        <output className={failed ? "gk-error-box" : "gk-result"}>
          {resultMessage}
        </output>
      ) : null}

      <form action={saveGestaoActivity}>
        {activity ? (
          <input name="activityId" type="hidden" value={activity.id} />
        ) : null}
        {activity ? (
          <input name="version" type="hidden" value={activity.version} />
        ) : null}
        {activity ? null : (
          <input name="idempotencyKey" type="hidden" value={randomUUID()} />
        )}
        <input name="memberIdsMode" type="hidden" value="SET" />
        <ActivityEditorHeader activity={activity} />
        <div className="gk-cols gk-cols--editor">
          <ActivityMainColumn activity={activity} data={data} />
          <aside className="gk-stack">
            <ActivityPublishingCard activity={activity} />
            <ActivityAudienceCard
              activity={activity}
              cohortIds={cohortIds}
              data={data}
            />
          </aside>
        </div>
      </form>

      {activity?.status === "PUBLISHED" && activity.cohortTargets.length ? (
        <section
          aria-labelledby="activity-reminders-title"
          className="gk-card gk-card--wide gk-reminders"
        >
          <h2 id="activity-reminders-title">Lembretes por turma</h2>
          <p className="gk-hint">
            O lembrete vai somente para alunos elegíveis desta turma que ainda
            não enviaram a atividade.
          </p>
          {activity.cohortTargets.map(({ cohortId }) => {
            const cohort = data.cohorts.find((item) => item.id === cohortId);
            if (!cohort) {
              return null;
            }
            return (
              <SingleFlightForm
                action={remindGestaoActivityCohort}
                className="gk-reminder-row"
                key={cohortId}
              >
                <input name="activityId" type="hidden" value={activity.id} />
                <input name="cohortId" type="hidden" value={cohortId} />
                <input
                  name="idempotencyKey"
                  type="hidden"
                  value={randomUUID()}
                />
                <span>{cohort.name}</span>
                <SingleFlightSubmit
                  pendingLabel="Enviando lembrete…"
                  variant="outline"
                >
                  Lembrar pendentes
                </SingleFlightSubmit>
              </SingleFlightForm>
            );
          })}
        </section>
      ) : null}

      {activity?.status === "PUBLISHED" ? (
        <SingleFlightForm
          action={setGestaoActivityStatus}
          className="gk-archive-row"
        >
          <input name="activityId" type="hidden" value={activity.id} />
          <input name="version" type="hidden" value={activity.version} />
          <input name="status" type="hidden" value="ARCHIVED" />
          <SingleFlightSubmit variant="outline">
            <GestaoIcon name="archive" size={14} /> Arquivar atividade
          </SingleFlightSubmit>
        </SingleFlightForm>
      ) : null}
    </section>
  );
};
