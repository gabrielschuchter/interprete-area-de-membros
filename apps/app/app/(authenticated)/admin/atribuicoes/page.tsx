import { randomUUID } from "node:crypto";
import {
  ContentStatus,
  CourseExperience,
  database,
  LearningAssignmentTargetType,
} from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { GroupMemberInvitePicker } from "@/components/community/group-member-invite-picker";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { requireStaff } from "@/lib/authorization";
import { resolveLearningAssignmentTargets } from "@/lib/learning-assignments";
import {
  createLearningAssignment,
  revokeLearningAssignmentBatch,
} from "./actions";

interface AdminAssignmentsPageProperties {
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const targetLabel: Record<LearningAssignmentTargetType, string> = {
  ACTIVITY: "Atividade",
  COURSE: "Curso",
  MODULE: "Módulo",
  LESSON: "Aula",
  ASSET: "Material de aula",
  LIBRARY_ITEM: "Material da biblioteca",
  EXERCISE_LIST: "Lista de exercícios",
};

const dateLabel = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(date)
    : null;

const AdminAssignmentsPage = async ({
  searchParams,
}: AdminAssignmentsPageProperties) => {
  const [
    { userId },
    query,
    activities,
    courses,
    modules,
    lessons,
    assets,
    libraryItems,
    exerciseLists,
    groups,
    batches,
  ] = await Promise.all([
    requireStaff(),
    searchParams,
    database.activity.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 250,
    }),
    database.course.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        experience: CourseExperience.ASYNC,
      },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 250,
    }),
    database.module.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        course: { is: { status: ContentStatus.PUBLISHED } },
      },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        course: { select: { title: true } },
      },
      take: 500,
    }),
    database.lesson.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        module: {
          is: {
            status: ContentStatus.PUBLISHED,
            course: { is: { status: ContentStatus.PUBLISHED } },
          },
        },
      },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        module: { select: { course: { select: { title: true } } } },
      },
      take: 1000,
    }),
    database.lessonAsset.findMany({
      where: {
        lesson: {
          is: {
            status: ContentStatus.PUBLISHED,
            module: {
              is: {
                status: ContentStatus.PUBLISHED,
                course: { is: { status: ContentStatus.PUBLISHED } },
              },
            },
          },
        },
      },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 1000,
    }),
    database.libraryItem.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 500,
    }),
    database.exerciseList.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        bank: { is: { status: ContentStatus.PUBLISHED } },
      },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 500,
    }),
    database.communitySpace.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 500,
    }),
    database.learningAssignmentBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        targetId: true,
        targetType: true,
        audienceType: true,
        audienceSpace: { select: { title: true } },
        createdAt: true,
        availableAt: true,
        dueAt: true,
        expiresAt: true,
        message: true,
        createdBy: { select: { displayName: true } },
        _count: { select: { assignments: true } },
      },
    }),
  ]);
  const batchTargets = await resolveLearningAssignmentTargets(
    database,
    batches.map(({ targetId, targetType }) => ({
      id: targetId,
      type: targetType,
    }))
  );
  const audienceLabels = {
    INDIVIDUAL: "Um aluno",
    SELECTED_MEMBERS: "Alunos selecionados",
    GROUP: "Grupo de estudo",
    ALL_MEMBERS: "Todos os alunos",
  } as const;
  const resultMessages: Record<string, string> = {
    created:
      "Conteúdo atribuído. Os avisos já estão na fila durável de entrega.",
    replayed:
      "Este envio já havia sido registrado; nenhuma atribuição duplicada foi criada.",
    invalid:
      "Não foi possível atribuir. Confira conteúdo, público, datas e seleções.",
  };
  const resultMessage = query.resultado
    ? (resultMessages[query.resultado] ?? null)
    : null;
  const options = [
    {
      label: "Atividades",
      type: LearningAssignmentTargetType.ACTIVITY,
      items: activities.map((item) => ({ id: item.id, label: item.title })),
    },
    {
      label: "Cursos",
      type: LearningAssignmentTargetType.COURSE,
      items: courses.map((item) => ({ id: item.id, label: item.title })),
    },
    {
      label: "Módulos",
      type: LearningAssignmentTargetType.MODULE,
      items: modules.map((item) => ({
        id: item.id,
        label: `${item.course.title} · ${item.title}`,
      })),
    },
    {
      label: "Aulas",
      type: LearningAssignmentTargetType.LESSON,
      items: lessons.map((item) => ({
        id: item.id,
        label: `${item.module.course.title} · ${item.title}`,
      })),
    },
    {
      label: "Materiais de aula",
      type: LearningAssignmentTargetType.ASSET,
      items: assets.map((item) => ({ id: item.id, label: item.title })),
    },
    {
      label: "Biblioteca",
      type: LearningAssignmentTargetType.LIBRARY_ITEM,
      items: libraryItems.map((item) => ({ id: item.id, label: item.title })),
    },
    {
      label: "Listas de exercícios",
      type: LearningAssignmentTargetType.EXERCISE_LIST,
      items: exerciseLists.map((item) => ({ id: item.id, label: item.title })),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-8 max-w-3xl">
        <p className="brand-eyebrow">Aprendizagem · acompanhamento</p>
        <h1 className="mt-4 font-display text-5xl leading-none">
          Envie um conteúdo para quem precisa dele.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          O aluno verá a atribuição em Aprender e receberá uma notificação.
          Acesso, prazo e estado ficam registrados por destinatário.
        </p>
      </header>
      {resultMessage && (
        <p
          aria-live="polite"
          className="mt-6 border-brand-action border-l-2 bg-muted/30 px-4 py-3 text-sm"
        >
          {resultMessage}
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)] lg:items-start">
        <section className="paper-surface border p-5 sm:p-8">
          <h2 className="font-display text-3xl">Nova atribuição</h2>
          <SingleFlightForm
            action={createLearningAssignment}
            className="mt-7 grid gap-6"
          >
            <input name="idempotencyKey" type="hidden" value={randomUUID()} />
            <label className="grid gap-2 text-sm" htmlFor="assignment-target">
              <span className="font-medium">Conteúdo publicado</span>
              <select
                className="h-11 w-full rounded-sm border bg-background px-3"
                defaultValue=""
                id="assignment-target"
                name="target"
                required
              >
                <option disabled value="">
                  Selecione um conteúdo
                </option>
                {options.map((group) => (
                  <optgroup key={group.type} label={group.label}>
                    {group.items.map((item) => (
                      <option key={item.id} value={`${group.type}:${item.id}`}>
                        {item.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm" htmlFor="assignment-audience">
              <span className="font-medium">Público</span>
              <select
                className="h-11 w-full rounded-sm border bg-background px-3"
                defaultValue="INDIVIDUAL"
                id="assignment-audience"
                name="audienceType"
              >
                <option value="INDIVIDUAL">Um aluno</option>
                <option value="SELECTED_MEMBERS">Alunos selecionados</option>
                <option value="GROUP">Membros de um grupo de estudo</option>
                <option value="ALL_MEMBERS">Todos os alunos</option>
              </select>
            </label>

            <GroupMemberInvitePicker
              currentMemberId={userId}
              description="Busque e escolha até 200 alunos. Para um aluno, selecione apenas uma pessoa."
              fieldName="memberIds"
              label="Alunos destinatários"
              maxSelected={200}
              studentsOnly
            />

            <label className="grid gap-2 text-sm" htmlFor="assignment-group">
              <span className="font-medium">Grupo de estudo</span>
              <select
                className="h-11 w-full rounded-sm border bg-background px-3"
                defaultValue=""
                id="assignment-group"
                name="audienceSpaceId"
              >
                <option value="">Selecione se o público for um grupo</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm" htmlFor="assignment-message">
              <span className="font-medium">Orientação (opcional)</span>
              <Textarea
                id="assignment-message"
                maxLength={1000}
                name="message"
                placeholder="Diga por que este conteúdo é relevante agora."
                rows={3}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["availableAt", "Disponível em"],
                ["dueAt", "Prazo"],
                ["expiresAt", "Acesso até"],
              ].map(([name, label]) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor={`assignment-${name}`}
                  key={name}
                >
                  <span className="font-medium">{label}</span>
                  <Input
                    id={`assignment-${name}`}
                    name={name}
                    type="datetime-local"
                  />
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              Horários são interpretados no fuso de São Paulo. A atribuição
              registra uma fotografia dos destinatários no momento do envio.
            </p>
            <div className="flex justify-end border-t pt-5">
              <SingleFlightSubmit>Enviar conteúdo</SingleFlightSubmit>
            </div>
          </SingleFlightForm>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4 border-b pb-3">
            <div>
              <p className="brand-eyebrow">Histórico persistido</p>
              <h2 className="mt-2 font-display text-3xl">Envios recentes</h2>
            </div>
            <span className="font-data text-muted-foreground text-xs">
              {batches.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {batches.length === 0 ? (
              <p className="py-6 text-muted-foreground text-sm">
                Nenhum conteúdo atribuído ainda.
              </p>
            ) : (
              batches.map((batch) => {
                const target = batchTargets.get(
                  `${batch.targetType}:${batch.targetId}`
                );
                return (
                  <article className="paper-surface border p-4" key={batch.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Badge variant="outline">
                          {targetLabel[batch.targetType]}
                        </Badge>
                        <h3 className="mt-3 font-medium leading-snug">
                          {target?.title ?? "Conteúdo indisponível"}
                        </h3>
                        <p className="mt-1 text-muted-foreground text-xs">
                          {audienceLabels[batch.audienceType]}
                          {batch.audienceSpace
                            ? ` · ${batch.audienceSpace.title}`
                            : ""}
                          {` · ${batch._count.assignments} destinatários`}
                        </p>
                        <p className="mt-2 text-muted-foreground text-xs">
                          {batch.createdBy?.displayName ?? "Equipe"} ·{" "}
                          {dateLabel(batch.createdAt)}
                        </p>
                        {batch.message && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                            {batch.message}
                          </p>
                        )}
                        {(batch.availableAt ||
                          batch.dueAt ||
                          batch.expiresAt) && (
                          <p className="mt-3 text-muted-foreground text-xs">
                            {batch.availableAt
                              ? `Disponível: ${dateLabel(batch.availableAt)} · `
                              : ""}
                            {batch.dueAt
                              ? `Prazo: ${dateLabel(batch.dueAt)} · `
                              : ""}
                            {batch.expiresAt
                              ? `Acesso até: ${dateLabel(batch.expiresAt)}`
                              : ""}
                          </p>
                        )}
                      </div>
                      <SingleFlightForm action={revokeLearningAssignmentBatch}>
                        <input name="batchId" type="hidden" value={batch.id} />
                        <Button size="sm" type="submit" variant="outline">
                          Revogar acesso
                        </Button>
                      </SingleFlightForm>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminAssignmentsPage;
