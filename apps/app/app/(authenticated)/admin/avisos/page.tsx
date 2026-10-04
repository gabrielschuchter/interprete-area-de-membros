import { ContentStatus, database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { requireStaff } from "@/lib/authorization";
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementStatus,
  updateAnnouncement,
} from "../actions";

const dateForInput = (value: Date | null) =>
  value
    ? new Date(value.valueOf() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16)
    : "";

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
  prefix,
}: {
  readonly announcement?: {
    readonly audience: string;
    readonly body: string;
    readonly endsAt: Date | null;
    readonly href: string | null;
    readonly id: string;
    readonly isPinned: boolean;
    readonly recipientIds: readonly string[];
    readonly startsAt: Date | null;
    readonly status: string;
    readonly title: string;
  };
  readonly prefix: string;
}) => (
  <>
    {announcement && <input name="id" type="hidden" value={announcement.id} />}
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
      <span className="font-medium">IDs dos membros selecionados</span>
      <Input
        defaultValue={announcement?.recipientIds.join(", ")}
        id={`${prefix}-recipients`}
        name="recipientIds"
        placeholder="Um ID por linha ou separado por vírgula"
      />
      <span className="text-muted-foreground text-xs">
        Usado somente quando o destino for “Membros selecionados”.
      </span>
    </label>
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
          defaultValue={dateForInput(announcement?.startsAt ?? null)}
          id={`${prefix}-starts-at`}
          name="startsAt"
          type="datetime-local"
        />
      </label>
      <label className="grid gap-2 text-sm" htmlFor={`${prefix}-ends-at`}>
        <span className="font-medium">Termina em (opcional)</span>
        <Input
          defaultValue={dateForInput(announcement?.endsAt ?? null)}
          id={`${prefix}-ends-at`}
          name="endsAt"
          type="datetime-local"
        />
      </label>
    </div>
    <label className="flex min-h-10 items-center gap-3 text-sm">
      <input
        defaultChecked={announcement?.isPinned ?? false}
        name="isPinned"
        type="checkbox"
      />
      Fixar no topo dos avisos da comunidade
    </label>
  </>
);

const AdminAnnouncementsPage = async () => {
  await requireStaff();
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
      createdAt: true,
      updatedAt: true,
    },
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

      <section className="paper-surface mt-10 border p-6 sm:p-8">
        <div className="border-border border-b pb-4">
          <p className="brand-eyebrow">Novo comunicado</p>
          <h2 className="mt-2 font-display text-3xl">
            Escreva para a comunidade
          </h2>
        </div>
        <form action={createAnnouncement} className="mt-6 grid gap-5">
          <AnnouncementFields prefix="new-announcement" />
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
                  <span className="text-muted-foreground text-xs">
                    · Atualizado em{" "}
                    {announcement.updatedAt.toLocaleDateString("pt-BR")}
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
                      announcement={announcement}
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
