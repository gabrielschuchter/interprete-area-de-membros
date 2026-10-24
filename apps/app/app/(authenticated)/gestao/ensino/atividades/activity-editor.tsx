import { randomUUID } from "node:crypto";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { ArrowLeftIcon, EyeIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { getGestaoActivityEditorData } from "@/lib/gestao-activities";
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

const ActivityMainColumn = ({
  data,
  activity,
}: {
  readonly data: EditorData;
  readonly activity: EditorData["activity"];
}) => (
  <div className="ga-activity-main-column">
    <section className="ga-form-card ga-prompt-card">
      <h2>Proposta</h2>
      <label htmlFor="activity-title">
        <span>Título da atividade</span>
        <Input
          defaultValue={activity?.title ?? ""}
          id="activity-title"
          maxLength={180}
          name="title"
          required
        />
      </label>
      <label htmlFor="activity-slug">
        <span>Endereço</span>
        <Input
          autoComplete="off"
          defaultValue={activity?.slug ?? ""}
          id="activity-slug"
          maxLength={120}
          name="slug"
          placeholder="Gerado a partir do título"
        />
      </label>
      <label htmlFor="activity-prompt">
        <span>Enunciado</span>
        <Textarea
          defaultValue={activity?.prompt ?? ""}
          id="activity-prompt"
          maxLength={20_000}
          name="prompt"
          required
          rows={8}
        />
      </label>
      <label htmlFor="activity-instructions">
        <span>Orientações para a entrega</span>
        <Textarea
          defaultValue={activity?.instructions ?? ""}
          id="activity-instructions"
          maxLength={20_000}
          name="instructions"
          rows={5}
        />
      </label>
    </section>

    <section className="ga-form-card">
      <h2>Formato da entrega</h2>
      <div className="ga-delivery-options">
        {[
          ["TEXT", "Texto", "O aluno escreve a resposta na plataforma."],
          ["FILE", "Arquivo", "O aluno envia um arquivo de entrega."],
          [
            "TEXT_AND_FILE",
            "Texto e arquivo",
            "A resposta combina texto e anexo.",
          ],
        ].map(([value, title, description]) => (
          <label className="ga-delivery-option" key={value}>
            <input
              defaultChecked={(activity?.deliveryKind ?? "TEXT") === value}
              name="deliveryKind"
              type="radio"
              value={value}
            />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </label>
        ))}
      </div>
    </section>

    <section className="ga-form-card">
      <RubricCriteriaEditor initial={activity?.rubricCriteria} />
    </section>
    <section className="ga-form-card">
      <h2>Material de apoio</h2>
      <label htmlFor="activity-library-item">
        <span>Leitura relacionada</span>
        <select
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
      </label>
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
  <section className="ga-form-card ga-audience-card">
    <h2>Destinatários</h2>
    <p>
      Combine turmas e alunos individuais. Acesso duplicado permanece único.
    </p>
    <fieldset className="ga-cohort-picker">
      <legend>Turmas</legend>
      {data.cohorts.length ? (
        data.cohorts.map((cohort) => (
          <label className="ga-cohort-option" key={cohort.id}>
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
                  ? "novos alunos recebem"
                  : "somente alunos presentes no envio"}
              </small>
            </span>
          </label>
        ))
      ) : (
        <p className="ga-empty-note">
          Nenhuma turma disponível para seu perfil.
        </p>
      )}
    </fieldset>
    <details
      className="ga-individual-picker"
      open={Boolean(data.selectedMembers.length)}
    >
      <summary>Adicionar alunos individualmente</summary>
      <ActivityMemberPicker initialSelected={data.selectedMembers} />
    </details>
    <label className="ga-course-target" htmlFor="activity-course">
      <span>Ou associe a um curso ou aula</span>
      <select
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
    </label>
    <label className="ga-course-target" htmlFor="activity-lesson">
      <span>Aula relacionada</span>
      <select
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
    </label>
  </section>
);

const ActivityPublishingCard = ({
  activity,
}: {
  readonly activity: EditorData["activity"];
}) => (
  <section className="ga-form-card ga-publishing-card">
    <h2>Publicação</h2>
    <label htmlFor="activity-due-at">
      <span>Prazo de entrega</span>
      <Input
        defaultValue={dateTimeLocal(activity?.dueAt ?? null)}
        id="activity-due-at"
        name="dueAt"
        type="datetime-local"
      />
    </label>
    {activity?.dueAt ? (
      <p>
        Prazo atual:{" "}
        {new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        }).format(activity.dueAt)}
      </p>
    ) : (
      <p>Informe um prazo futuro para publicar a atividade.</p>
    )}
    {activity ? (
      <Button asChild className="ga-preview-button" variant="outline">
        <Link
          href={`/gestao/ensino/atividades/${activity.id}/previa`}
          prefetch={false}
        >
          <EyeIcon aria-hidden="true" /> Prévia do aluno
        </Link>
      </Button>
    ) : (
      <Button
        className="ga-preview-button"
        disabled
        type="button"
        variant="outline"
      >
        <EyeIcon aria-hidden="true" /> Salve o rascunho para pré-visualizar
      </Button>
    )}
  </section>
);

const ActivityEditorActions = ({
  activity,
}: {
  readonly activity: EditorData["activity"];
}) => (
  <footer className="ga-activity-actions">
    <Button asChild variant="ghost">
      <Link href="/gestao/ensino/atividades">Cancelar</Link>
    </Button>
    <SingleFlightSubmit
      name="intent"
      pendingLabel="Salvando…"
      value="save"
      variant="outline"
    >
      {activity ? "Salvar alterações" : "Salvar rascunho"}
    </SingleFlightSubmit>
    {activity?.status !== "PUBLISHED" ? (
      <SingleFlightSubmit
        name="intent"
        pendingLabel="Publicando…"
        value="publish"
      >
        Publicar atividade
      </SingleFlightSubmit>
    ) : null}
  </footer>
);

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

  return (
    <section className="gestao-page-content ga-activity-editor-page">
      <Link className="ga-back-link" href="/gestao/ensino/atividades">
        <ArrowLeftIcon aria-hidden="true" /> Atividades
      </Link>
      <header className="ga-page-heading">
        <div>
          <p className="gestao-eyebrow">Gestão · Ensino</p>
          <h1>{activity ? "Editar atividade" : "Nova atividade"}</h1>
          <p>
            Proponha uma prática, defina como será entregue e combine critérios
            claros de avaliação.
          </p>
        </div>
        {activity ? (
          <span
            className={`ge-status ge-status-${activity.status.toLowerCase()}`}
          >
            {statusNames[activity.status]}
          </span>
        ) : null}
      </header>

      {resultMessage ? (
        <output className="ga-result">{resultMessage}</output>
      ) : null}

      <SingleFlightForm
        action={saveGestaoActivity}
        className="ga-activity-form"
      >
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
        <ActivityMainColumn activity={activity} data={data} />
        <aside className="ga-activity-side-column">
          <ActivityPublishingCard activity={activity} />
          <ActivityAudienceCard
            activity={activity}
            cohortIds={cohortIds}
            data={data}
          />
          <ActivityEditorActions activity={activity} />
        </aside>
      </SingleFlightForm>

      {activity?.status === "PUBLISHED" && activity.cohortTargets.length ? (
        <section
          aria-labelledby="activity-reminders-title"
          className="ga-form-card"
        >
          <h2 id="activity-reminders-title">Lembretes por turma</h2>
          <p>
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
                className="ga-activity-actions"
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
          className="ga-archive-form"
        >
          <input name="activityId" type="hidden" value={activity.id} />
          <input name="version" type="hidden" value={activity.version} />
          <input name="status" type="hidden" value="ARCHIVED" />
          <SingleFlightSubmit variant="outline">
            Arquivar atividade
          </SingleFlightSubmit>
        </SingleFlightForm>
      ) : null}
    </section>
  );
};
