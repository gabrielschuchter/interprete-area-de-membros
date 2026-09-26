import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { requireStaff } from "@/lib/authorization";
import { createAnnouncement } from "../actions";

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);

const AdminAnnouncementsPage = async () => {
  await requireStaff();
  const recentAnnouncements = await database.notification.findMany({
    where: { type: "ANNOUNCEMENT" },
    orderBy: { createdAt: "desc" },
    distinct: ["groupKey"],
    take: 12,
    select: { body: true, createdAt: true, groupKey: true, title: true },
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
          Publique comunicados dentro da área de membros. O envio respeita as
          preferências de avisos de cada pessoa e não dispara e-mail.
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section className="paper-surface border p-6 sm:p-8">
          <div className="border-border border-b pb-4">
            <p className="brand-eyebrow">Novo comunicado</p>
            <h2 className="mt-2 font-display text-3xl">
              Escreva para a comunidade
            </h2>
          </div>
          <form action={createAnnouncement} className="mt-6 grid gap-5">
            <label className="grid gap-2 text-sm" htmlFor="announcement-title">
              <span className="font-medium">Título</span>
              <Input
                id="announcement-title"
                maxLength={180}
                name="title"
                required
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="announcement-body">
              <span className="font-medium">Mensagem</span>
              <Textarea
                className="min-h-40"
                id="announcement-body"
                maxLength={10_000}
                name="body"
                required
              />
            </label>
            <label
              className="grid gap-2 text-sm"
              htmlFor="announcement-audience"
            >
              <span className="font-medium">Destino</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="ALL"
                id="announcement-audience"
                name="audience"
              >
                <option value="ALL">Todos os membros</option>
                <option value="STAFF">Professores e administradores</option>
                <option value="SELECTED">Membros selecionados</option>
              </select>
            </label>
            <label
              className="grid gap-2 text-sm"
              htmlFor="announcement-recipients"
            >
              <span className="font-medium">IDs dos membros selecionados</span>
              <Input
                id="announcement-recipients"
                name="recipientIds"
                placeholder="Um ID por linha ou separado por vírgula"
              />
              <span className="text-muted-foreground text-xs">
                Usado somente quando o destino for “Membros selecionados”.
              </span>
            </label>
            <label className="grid gap-2 text-sm" htmlFor="announcement-href">
              <span className="font-medium">Link opcional</span>
              <Input
                id="announcement-href"
                name="href"
                placeholder="/encontros ou https://..."
                type="text"
              />
            </label>
            <div>
              <Button type="submit">Publicar aviso</Button>
            </div>
          </form>
        </section>

        <aside className="border-border border-t pt-5 lg:border-t-0 lg:border-l lg:pl-6">
          <p className="brand-eyebrow">Histórico recente</p>
          <div className="mt-4 divide-y border-border border-y">
            {recentAnnouncements.length === 0 ? (
              <p className="py-5 text-muted-foreground text-sm">
                Nenhum comunicado publicado ainda.
              </p>
            ) : (
              recentAnnouncements.map((announcement) => (
                <article
                  className="py-4"
                  key={
                    announcement.groupKey ??
                    announcement.createdAt.toISOString()
                  }
                >
                  <h2 className="font-medium text-sm">{announcement.title}</h2>
                  <p className="mt-1 line-clamp-3 text-muted-foreground text-sm">
                    {announcement.body}
                  </p>
                  <p className="mt-2 text-muted-foreground text-xs">
                    {formatDate(announcement.createdAt)}
                  </p>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default AdminAnnouncementsPage;
