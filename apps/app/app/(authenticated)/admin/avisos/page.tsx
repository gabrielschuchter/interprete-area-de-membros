import { AnnouncementAudience, ContentStatus, database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { announcementDateTimeForInput } from "@/lib/announcement-time";
import { requireStaff } from "@/lib/authorization";
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementStatus,
  updateAnnouncement,
} from "../actions";

const formatSaoPauloDate = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(value);

const statusLabel = (status: string) => {
  if (status === ContentStatus.PUBLISHED) {
    return "Publicado";
  }
  if (status === ContentStatus.ARCHIVED) {
    return "Arquivado";
  }
  return "Rascunho";
};

const AnnouncementFields = ({
  announcement,
  cohorts,
  prefix,
}: {
  readonly announcement?: {
    readonly audience: string;
    readonly body: string;
    readonly cohortIds: readonly string[];
    readonly endsAt: Date | null;
    readonly href: string | null;
    readonly id: string;
    readonly isImportant: boolean;
    readonly isPinned: boolean;
    readonly recipientIds: readonly string[];
    readonly startsAt: Date | null;
    readonly status: string;
    readonly title: string;
    readonly version: number;
  };
  readonly cohorts: readonly {
    readonly archivedAt: Date | null;
    readonly id: string;
    readonly name: string;
  }[];
  readonly prefix: string;
}) => (
  <>
    {announcement && (
      <>
        <input name="id" type="hidden" value={announcement.id} />
        <input
          name="expectedVersion"
          type="hidden"
          value={announcement.version}
        />
      </>
    )}
    <label className="grid gap-2 text-sm" htmlFor={`${prefix}-title`}>
      <span className="font-medium">Título</span>
      <Input
        defaultValue={announcement?.title}
        id={`${prefix}-title`}
        maxLength={180}
        name="title"
        required
      />
    </label>
    <label className="grid gap-2 text-sm" htmlFor={`${prefix}-body`}>
      <span className="font-medium">Mensagem</span>
      <Textarea
        className="min-h-28"
        defaultValue={announcement?.body}
        id={`${prefix}-body`}
        maxLength={10_000}
        name="body"
        required
      />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm" htmlFor={`${prefix}-audience`}>
        <span className="font-medium">Destino</span>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={announcement?.audience ?? "ALL"}
          id={`${prefix}-audience`}
          name="audience"
        >
          <option value="ALL">Todos os membros</option>
          <option value="STAFF">Professores e administradores</option>
          <option value="SELECTED">Membros selecionados</option>
          <option value={AnnouncementAudience.COHORT}>
            Turmas selecionadas
          </option>
        </select>
      </label>
      <label className="grid gap-2 text-sm" htmlFor={`${prefix}-status`}>
        <span className="font-medium">Estado</span>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={announcement?.status ?? ContentStatus.PUBLISHED}
          id={`${prefix}-status`}
          name="status"
        >
          <option value={ContentStatus.DRAFT}>Rascunho</option>
          <option value={ContentStatus.PUBLISHED}>Publicado</option>
          <option value={ContentStatus.ARCHIVED}>Arquivado</option>
        </select>
      </label>
    </div>
    <label className="grid gap-2 text-sm" htmlFor={`${prefix}-recipients`}>
      <span className="font-medium">Membros selecionados</span>
      <Input
        defaultValue={announcement?.recipientIds.join(", ")}
        id={`${prefix}-recipients`}
        name="recipientIds"
        placeholder="IDs já existentes, separados por vírgula"
      />
      <span className="text-muted-foreground text-xs">
        Usado somente quando a audiência for “Membros selecionados”.
      </span>
    </label>
    <fieldset className="grid gap-2 text-sm">
      <legend className="font-medium">Turmas</legend>
      <select
        aria-label="Turmas da audiência"
        className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
        defaultValue={announcement?.cohortIds ?? []}
        id={`${prefix}-cohorts`}
        multiple
        name="cohortIds"
      >
        {cohorts.map((cohort) => (
          <option key={cohort.id} value={cohort.id}>
            {cohort.name}
            {cohort.archivedAt ? " · arquivada" : ""}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground text-xs">
        Usado somente para “Turmas selecionadas”. Digite Ctrl ou Command para
        escolher mais de uma turma.
      </span>
    </fieldset>
    <p className="text-muted-foreground text-xs">
      Este aviso aparece somente na Comunidade.
    </p>
    <label className="grid gap-2 text-sm" htmlFor={`${prefix}-href`}>
      <span className="font-medium">Link opcional</span>
      <Input
        defaultValue={announcement?.href ?? ""}
        id={`${prefix}-href`}
        name="href"
        placeholder="/encontros ou https://..."
      />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm" htmlFor={`${prefix}-starts-at`}>
        <span className="font-medium">Começa em (opcional)</span>
        <Input
          defaultValue={announcementDateTimeForInput(
            announcement?.startsAt ?? null
          )}
          id={`${prefix}-starts-at`}
          name="startsAt"
          type="datetime-local"
        />
      </label>
      <label className="grid gap-2 text-sm" htmlFor={`${prefix}-ends-at`}>
        <span className="font-medium">Termina em (opcional)</span>
        <Input
          defaultValue={announcementDateTimeForInput(
            announcement?.endsAt ?? null
          )}
          id={`${prefix}-ends-at`}
          name="endsAt"
          type="datetime-local"
        />
      </label>
    </div>
    <p className="text-muted-foreground text-xs">
      Os horários seguem America/Sao_Paulo. O aviso começa no horário inicial e
      deixa de aparecer no horário final.
    </p>
    <label className="flex min-h-10 items-center gap-3 text-sm">
      <input
        defaultChecked={announcement?.isPinned ?? false}
        name="isPinned"
        type="checkbox"
      />
      Fixar no topo dos avisos da comunidade
    </label>
    <label className="flex min-h-10 items-center gap-3 text-sm">
      <input
        defaultChecked={announcement?.isImportant ?? false}
        name="isImportant"
        type="checkbox"
      />
      Aviso importante no topo do feed da comunidade
    </label>
  </>
);

const AdminAnnouncementsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly erro?: string }>;
}) => {
  await requireStaff();
  const { erro } = await searchParams;
  const announcements = await database.announcement.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { isPinned: "desc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      body: true,
      href: true,
      audience: true,
      recipientIds: true,
      status: true,
      startsAt: true,
      endsAt: true,
      isPinned: true,
      isImportant: true,
      version: true,
      cohorts: {
        select: {
          cohortId: true,
          cohort: { select: { id: true, name: true, archivedAt: true } },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
  const cohorts = await database.cohort.findMany({
    where: {
      OR: [
        { archivedAt: null },
        {
          announcementTargets: {
            some: { announcementId: { in: announcements.map(({ id }) => id) } },
          },
        },
      ],
    },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    take: 250,
    select: { id: true, name: true, archivedAt: true },
  });

  return (
    <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-10 max-w-3xl">
        <p className="brand-eyebrow">Professor · avisos</p>
        <span aria-hidden="true" className="brand-rule mt-4" />
        <h1 className="mt-6 font-display text-5xl leading-[1.02]">
          Uma mensagem, no lugar certo.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Crie, edite, fixe, agende, publique ou arquive avisos persistidos. A
          entrega respeita preferências e não dispara e-mail.
        </p>
      </header>

      {erro === "conflito" ? (
        <output className="mt-6 block rounded-md border border-amber-700/30 bg-amber-50 p-4 text-amber-950 text-sm">
          Este aviso mudou em outra edição. Confira a versão atual e tente
          novamente.
        </output>
      ) : null}
      {erro === "destino" ? (
        <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          A audiência selecionada não está mais disponível. Revise os membros ou
          turmas.
        </p>
      ) : null}

      <section className="paper-surface mt-10 border p-6 sm:p-8">
        <div className="border-border border-b pb-4">
          <p className="brand-eyebrow">Novo comunicado</p>
          <h2 className="mt-2 font-display text-3xl">
            Escreva para a comunidade
          </h2>
        </div>
        <form action={createAnnouncement} className="mt-6 grid gap-5">
          <AnnouncementFields cohorts={cohorts} prefix="new-announcement" />
          <Button className="w-fit" type="submit">
            Salvar aviso
          </Button>
        </form>
      </section>

      <section aria-labelledby="announcements-heading" className="mt-12">
        <div className="flex items-end justify-between border-border border-b pb-3">
          <div>
            <p className="brand-eyebrow">Acervo editorial</p>
            <h2
              className="mt-2 font-display text-3xl"
              id="announcements-heading"
            >
              Avisos
            </h2>
          </div>
          <span className="font-data text-muted-foreground text-xs">
            {announcements.length} avisos
          </span>
        </div>
        {announcements.length === 0 ? (
          <p className="py-6 text-muted-foreground">
            Nenhum aviso criado ainda.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {announcements.map((announcement) => (
              <article
                className="paper-surface border p-5 sm:p-7"
                data-admin-announcement-id={announcement.id}
                key={announcement.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="brand-eyebrow">
                    {statusLabel(announcement.status)}
                  </span>
                  {announcement.isPinned && (
                    <span className="text-muted-foreground text-xs">
                      · Fixado
                    </span>
                  )}
                  {announcement.isImportant && (
                    <span className="text-muted-foreground text-xs">
                      · Importante no feed
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    · Atualizado em {formatSaoPauloDate(announcement.updatedAt)}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-2xl">
                  {announcement.title}
                </h3>
                <p className="mt-2 line-clamp-3 max-w-3xl whitespace-pre-wrap text-muted-foreground leading-7">
                  {announcement.body}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={setAnnouncementStatus}>
                    <input name="id" type="hidden" value={announcement.id} />
                    <input
                      name="expectedVersion"
                      type="hidden"
                      value={announcement.version}
                    />
                    <input
                      name="status"
                      type="hidden"
                      value={
                        announcement.status === ContentStatus.PUBLISHED
                          ? ContentStatus.DRAFT
                          : ContentStatus.PUBLISHED
                      }
                    />
                    <Button size="sm" type="submit" variant="outline">
                      {announcement.status === ContentStatus.PUBLISHED
                        ? "Despublicar"
                        : "Publicar"}
                    </Button>
                  </form>
                  <form action={deleteAnnouncement}>
                    <input name="id" type="hidden" value={announcement.id} />
                    <input
                      name="expectedVersion"
                      type="hidden"
                      value={announcement.version}
                    />
                    <Button size="sm" type="submit" variant="ghost">
                      Excluir
                    </Button>
                  </form>
                </div>
                <details className="mt-5 border-border border-t pt-4">
                  <summary className="cursor-pointer text-muted-foreground text-sm underline underline-offset-4">
                    Editar aviso
                  </summary>
                  <form action={updateAnnouncement} className="mt-5 grid gap-5">
                    <AnnouncementFields
                      announcement={{
                        ...announcement,
                        cohortIds: announcement.cohorts.map(
                          ({ cohortId }) => cohortId
                        ),
                      }}
                      cohorts={cohorts}
                      prefix={`edit-${announcement.id}`}
                    />
                    <Button className="w-fit" size="sm" type="submit">
                      Salvar alterações
                    </Button>
                  </form>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default AdminAnnouncementsPage;
