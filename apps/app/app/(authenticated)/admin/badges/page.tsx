import { BadgeCriterion, ContentStatus, database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { AwardIcon } from "lucide-react";
import { requireStaff } from "@/lib/authorization";
import { saveBadgeDefinition, setBadgeStatus } from "./actions";

const criterionLabels: Record<BadgeCriterion, string> = {
  STUDY_MINUTES: "Minutos estudados",
  STUDY_STREAK_DAYS: "Dias consecutivos de estudo",
  STUDY_GOALS_MET: "Metas de estudo atingidas",
  EXERCISE_ANSWERS: "Questões respondidas",
  ACTIVITIES_COMPLETED: "Atividades entregues",
  COMMUNITY_PUBLICATIONS: "Publicações na comunidade",
  LESSONS_COMPLETED: "Aulas concluídas",
  TASKS_COMPLETED: "Tarefas concluídas",
  LEARNING_PATHS_COMPLETED: "Trilhas concluídas",
  MEETINGS_ATTENDED: "Encontros com presença confirmada",
};

const statusLabel = (status: ContentStatus) => {
  if (status === ContentStatus.PUBLISHED) {
    return "Publicada";
  }
  if (status === ContentStatus.ARCHIVED) {
    return "Arquivada";
  }
  return "Rascunho";
};

interface AdminBadgesPageProperties {
  readonly searchParams: Promise<{ resultado?: string }>;
}

const AdminBadgesPage = async ({ searchParams }: AdminBadgesPageProperties) => {
  await requireStaff();
  const [{ resultado }, definitions] = await Promise.all([
    searchParams,
    database.badgeDefinition.findMany({
      orderBy: [{ status: "asc" }, { criterion: "asc" }, { threshold: "asc" }],
      take: 200,
      include: { _count: { select: { awards: true } } },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="max-w-3xl">
        <p className="brand-eyebrow">Painel do professor · reconhecimento</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">Medalhas</h1>
        <p className="mt-4 text-muted-foreground leading-7">
          Crie critérios a partir dos sinais persistidos da plataforma. A regra
          é avaliada no servidor e cada membro recebe cada medalha uma única
          vez.
        </p>
      </header>

      {resultado && (
        <p className="mt-6 border-brand-action border-l-2 bg-brand-action/10 px-4 py-3 text-sm">
          {resultado === "salvo" || resultado === "atualizado"
            ? "Medalha atualizada."
            : "Revise os campos e tente novamente."}
        </p>
      )}

      <section
        aria-labelledby="new-badge-heading"
        className="paper-surface mt-8 border p-5 sm:p-7"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-action/10 text-brand-action-text">
            <AwardIcon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="brand-eyebrow">Nova definição</p>
            <h2 className="font-display text-2xl" id="new-badge-heading">
              Criar medalha
            </h2>
          </div>
        </div>
        <form
          action={saveBadgeDefinition}
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          <label className="grid gap-2 text-sm" htmlFor="badge-title">
            <span className="font-medium">Nome</span>
            <Input id="badge-title" maxLength={120} name="title" required />
          </label>
          <label className="grid gap-2 text-sm" htmlFor="badge-criterion">
            <span className="font-medium">Critério</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              id="badge-criterion"
              name="criterion"
            >
              {Object.values(BadgeCriterion).map((criterion) => (
                <option key={criterion} value={criterion}>
                  {criterionLabels[criterion]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm" htmlFor="badge-threshold">
            <span className="font-medium">Quantidade necessária</span>
            <Input
              id="badge-threshold"
              max={1_000_000}
              min={1}
              name="threshold"
              required
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm" htmlFor="badge-image">
            <span className="font-medium">Imagem HTTPS opcional</span>
            <Input
              id="badge-image"
              maxLength={2000}
              name="imageUrl"
              type="url"
            />
          </label>
          <label
            className="grid gap-2 text-sm sm:col-span-2"
            htmlFor="badge-description"
          >
            <span className="font-medium">Descrição</span>
            <Textarea
              id="badge-description"
              maxLength={1000}
              name="description"
              required
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Salvar como rascunho</Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="badge-definitions-heading" className="mt-12">
        <div className="flex items-end justify-between border-b pb-4">
          <div>
            <p className="brand-eyebrow">Critérios versionados</p>
            <h2
              className="mt-2 font-display text-3xl"
              id="badge-definitions-heading"
            >
              Definições existentes
            </h2>
          </div>
          <span className="font-data text-muted-foreground text-sm">
            {definitions.length}
          </span>
        </div>
        {definitions.length === 0 ? (
          <p className="mt-5 text-muted-foreground">
            Nenhuma medalha cadastrada.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {definitions.map((definition) => (
              <article
                className="paper-surface border p-5 sm:p-6"
                key={definition.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="brand-eyebrow">
                      {criterionLabels[definition.criterion]} ·{" "}
                      {definition.threshold}
                    </p>
                    <h3 className="mt-2 font-display text-2xl">
                      {definition.title}
                    </h3>
                    <p className="mt-2 max-w-3xl text-muted-foreground text-sm leading-6">
                      {definition.description}
                    </p>
                    <p className="mt-3 text-muted-foreground text-xs">
                      {statusLabel(definition.status)} ·{" "}
                      {definition._count.awards} conquistas registradas
                    </p>
                  </div>
                  <form
                    action={setBadgeStatus}
                    className="flex flex-wrap gap-2"
                  >
                    <input name="id" type="hidden" value={definition.id} />
                    {definition.status !== ContentStatus.PUBLISHED ? (
                      <Button
                        name="status"
                        size="sm"
                        type="submit"
                        value={ContentStatus.PUBLISHED}
                        variant="outline"
                      >
                        Publicar
                      </Button>
                    ) : (
                      <Button
                        name="status"
                        size="sm"
                        type="submit"
                        value={ContentStatus.DRAFT}
                        variant="outline"
                      >
                        Despublicar
                      </Button>
                    )}
                    {definition.status !== ContentStatus.ARCHIVED && (
                      <Button
                        name="status"
                        size="sm"
                        type="submit"
                        value={ContentStatus.ARCHIVED}
                        variant="ghost"
                      >
                        Arquivar
                      </Button>
                    )}
                  </form>
                </div>
                {definition.status !== ContentStatus.ARCHIVED && (
                  <details className="mt-5 border-t pt-4">
                    <summary className="cursor-pointer text-sm underline underline-offset-4">
                      Editar definição
                    </summary>
                    <form
                      action={saveBadgeDefinition}
                      className="mt-4 grid gap-4 sm:grid-cols-2"
                    >
                      <input name="id" type="hidden" value={definition.id} />
                      <label
                        className="grid gap-2 text-sm"
                        htmlFor={`badge-title-${definition.id}`}
                      >
                        <span className="font-medium">Nome</span>
                        <Input
                          defaultValue={definition.title}
                          id={`badge-title-${definition.id}`}
                          maxLength={120}
                          name="title"
                          required
                        />
                      </label>
                      <label
                        className="grid gap-2 text-sm"
                        htmlFor={`badge-criterion-${definition.id}`}
                      >
                        <span className="font-medium">Critério</span>
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          defaultValue={definition.criterion}
                          id={`badge-criterion-${definition.id}`}
                          name="criterion"
                        >
                          {Object.values(BadgeCriterion).map((criterion) => (
                            <option key={criterion} value={criterion}>
                              {criterionLabels[criterion]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label
                        className="grid gap-2 text-sm"
                        htmlFor={`badge-threshold-${definition.id}`}
                      >
                        <span className="font-medium">
                          Quantidade necessária
                        </span>
                        <Input
                          defaultValue={definition.threshold}
                          id={`badge-threshold-${definition.id}`}
                          max={1_000_000}
                          min={1}
                          name="threshold"
                          required
                          type="number"
                        />
                      </label>
                      <label
                        className="grid gap-2 text-sm"
                        htmlFor={`badge-image-${definition.id}`}
                      >
                        <span className="font-medium">
                          Imagem HTTPS opcional
                        </span>
                        <Input
                          defaultValue={definition.imageUrl ?? ""}
                          id={`badge-image-${definition.id}`}
                          maxLength={2000}
                          name="imageUrl"
                          type="url"
                        />
                      </label>
                      <label
                        className="grid gap-2 text-sm sm:col-span-2"
                        htmlFor={`badge-description-${definition.id}`}
                      >
                        <span className="font-medium">Descrição</span>
                        <Textarea
                          defaultValue={definition.description}
                          id={`badge-description-${definition.id}`}
                          maxLength={1000}
                          name="description"
                          required
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <Button size="sm" type="submit" variant="outline">
                          Salvar alterações
                        </Button>
                      </div>
                    </form>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default AdminBadgesPage;
