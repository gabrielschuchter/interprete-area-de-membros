import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { getCourseOptions } from "@/lib/admin-learning";
import { getStaffMeetings } from "@/lib/meetings";

const statusLabel = (status: string) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }
  if (status === "ARCHIVED") {
    return "Arquivado";
  }
  return "Rascunho";
};

import { createMeeting, setMeetingStatus } from "../../encontros/actions";

const formatDate = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);

const AdminMeetingsPage = async () => {
  const [meetings, courses] = await Promise.all([
    getStaffMeetings(),
    getCourseOptions(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-10 max-w-3xl">
        <p className="brand-eyebrow">Professor · encontros</p>
        <h1 className="mt-4 font-display text-5xl leading-none">
          Uma sala com hora marcada.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Publique encontros e materiais de acesso. O vídeo acontece em um
          serviço externo; aqui cuidamos do contexto.
        </p>
      </header>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <h2 className="border-border border-b pb-3 font-display text-3xl">
            Agenda editorial
          </h2>
          <div className="mt-5 divide-y border-border border-y">
            {meetings.length === 0 ? (
              <p className="py-5 text-muted-foreground">
                Nenhum encontro criado.
              </p>
            ) : (
              meetings.map((meeting) => (
                <article className="py-5" key={meeting.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <Badge
                        variant={
                          meeting.status === "PUBLISHED" ? "default" : "outline"
                        }
                      >
                        {statusLabel(meeting.status)}
                      </Badge>
                      <h3 className="mt-3 font-display text-2xl">
                        {meeting.title}
                      </h3>
                      <p className="mt-2 text-muted-foreground text-sm">
                        {formatDate(meeting.startsAt, meeting.timezone)}
                      </p>
                      {meeting.course && (
                        <p className="mt-1 text-muted-foreground text-sm">
                          {meeting.course.title}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {meeting.status !== "PUBLISHED" && (
                        <form action={setMeetingStatus}>
                          <input name="id" type="hidden" value={meeting.id} />
                          <input
                            name="status"
                            type="hidden"
                            value="PUBLISHED"
                          />
                          <Button size="sm" type="submit">
                            Publicar
                          </Button>
                        </form>
                      )}
                      {meeting.status === "PUBLISHED" && (
                        <form action={setMeetingStatus}>
                          <input name="id" type="hidden" value={meeting.id} />
                          <input name="status" type="hidden" value="ARCHIVED" />
                          <Button size="sm" type="submit" variant="outline">
                            Arquivar
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Novo encontro</p>
          <form action={createMeeting} className="mt-5 space-y-4">
            <label className="block" htmlFor="meeting-title">
              <span className="brand-eyebrow">Título</span>
              <Input
                className="mt-2"
                id="meeting-title"
                name="title"
                placeholder="Discussão de um artigo"
                required
              />
            </label>
            <label className="block" htmlFor="meeting-description">
              <span className="brand-eyebrow">Contexto</span>
              <Textarea
                className="mt-2 min-h-24"
                id="meeting-description"
                name="description"
              />
            </label>
            <label className="block" htmlFor="meeting-start">
              <span className="brand-eyebrow">Data e hora</span>
              <Input
                className="mt-2"
                id="meeting-start"
                name="startsAt"
                required
                type="datetime-local"
              />
            </label>
            <label className="block" htmlFor="meeting-end">
              <span className="brand-eyebrow">Fim (opcional)</span>
              <Input
                className="mt-2"
                id="meeting-end"
                name="endsAt"
                type="datetime-local"
              />
            </label>
            <label className="block" htmlFor="meeting-kind">
              <span className="brand-eyebrow">Tipo</span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue="OTHER"
                id="meeting-kind"
                name="kind"
              >
                <option value="INDIVIDUAL">Mentoria individual</option>
                <option value="LESSON">Aula</option>
                <option value="GROUP">Encontro em grupo</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="FEEDBACK">Sessão de feedback</option>
                <option value="OTHER">Outro</option>
              </select>
            </label>
            <label className="block" htmlFor="meeting-timezone">
              <span className="brand-eyebrow">Fuso</span>
              <Input
                className="mt-2"
                defaultValue="America/Sao_Paulo"
                id="meeting-timezone"
                name="timezone"
                required
              />
            </label>
            <label className="block" htmlFor="meeting-url">
              <span className="brand-eyebrow">Link externo</span>
              <Input
                className="mt-2"
                id="meeting-url"
                name="joinUrl"
                placeholder="https://..."
                required
                type="url"
              />
            </label>
            <label className="block" htmlFor="meeting-course">
              <span className="brand-eyebrow">
                Curso relacionado (opcional)
              </span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue=""
                id="meeting-course"
                name="courseId"
              >
                <option value="">Nenhum curso</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block" htmlFor="meeting-recording">
              <span className="brand-eyebrow">Gravação (opcional)</span>
              <Input
                className="mt-2"
                id="meeting-recording"
                name="recordingUrl"
                placeholder="https://..."
                type="url"
              />
            </label>
            <Button className="w-full" type="submit">
              Salvar como rascunho
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default AdminMeetingsPage;
