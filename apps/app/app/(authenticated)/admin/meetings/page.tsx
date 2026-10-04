import { randomUUID } from "node:crypto";
import { database } from "@repo/database";
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

import {
  createMeeting,
  saveMeetingAttendance,
  setMeetingStatus,
  updateMeeting,
} from "../../encontros/actions";

const formatDate = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);

const AdminMeetingsPage = async () => {
  const [meetings, courses, members, activities, libraryItems] =
    await Promise.all([
      getStaffMeetings(),
      getCourseOptions(),
      database.member.findMany({
        where: { deactivatedAt: null },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true, email: true },
        take: 200,
      }),
      database.activity.findMany({
        orderBy: [{ status: "asc" }, { title: "asc" }],
        select: { id: true, title: true, slug: true },
        take: 200,
      }),
      database.libraryItem.findMany({
        orderBy: { title: "asc" },
        select: { id: true, title: true },
        take: 200,
      }),
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
              // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the row intentionally keeps scheduling, relations, participants, and publication controls together.
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
                      <p className="mt-1 text-muted-foreground text-xs">
                        {meeting._count.participants > 0
                          ? `${meeting._count.participants} participante(s)`
                          : "Acesso por curso/feed"}
                        {meeting.relatedActivity
                          ? ` · atividade: ${meeting.relatedActivity.title}`
                          : ""}
                        {meeting.relatedLibraryItem
                          ? ` · leitura: ${meeting.relatedLibraryItem.title}`
                          : ""}
                      </p>
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
                  <details className="mt-5 border-border border-t pt-4">
                    <summary className="cursor-pointer text-muted-foreground text-sm underline underline-offset-4">
                      Editar encontro e participantes
                    </summary>
                    <form action={updateMeeting} className="mt-4 grid gap-3">
                      <input name="id" type="hidden" value={meeting.id} />
                      <Input
                        defaultValue={meeting.title}
                        name="title"
                        required
                      />
                      <Textarea
                        defaultValue={meeting.description ?? ""}
                        name="description"
                        placeholder="Contexto"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          defaultValue={meeting.startsAt
                            .toISOString()
                            .slice(0, 16)}
                          name="startsAt"
                          required
                          type="datetime-local"
                        />
                        <Input
                          defaultValue={
                            meeting.endsAt?.toISOString().slice(0, 16) ?? ""
                          }
                          name="endsAt"
                          type="datetime-local"
                        />
                      </div>
                      <select
                        className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                        defaultValue={meeting.kind}
                        name="kind"
                      >
                        <option value="INDIVIDUAL">Mentoria individual</option>
                        <option value="LESSON">Aula</option>
                        <option value="GROUP">Encontro em grupo</option>
                        <option value="WORKSHOP">Workshop</option>
                        <option value="FEEDBACK">Sessão de feedback</option>
                        <option value="OTHER">Outro</option>
                      </select>
                      <Input
                        defaultValue={meeting.timezone}
                        name="timezone"
                        required
                      />
                      <Input
                        defaultValue={meeting.joinUrl}
                        name="joinUrl"
                        required
                        type="url"
                      />
                      <Input
                        defaultValue={meeting.recordingUrl ?? ""}
                        name="recordingUrl"
                        placeholder="Gravação (opcional)"
                        type="url"
                      />
                      <Input
                        defaultValue={meeting.recurrenceRule ?? ""}
                        name="recurrenceRule"
                        placeholder="Recorrência (opcional, ex.: semanal)"
                      />
                      <select
                        className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                        defaultValue={meeting.course?.id ?? ""}
                        name="courseId"
                      >
                        <option value="">Nenhum curso</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                        defaultValue={meeting.relatedActivity?.id ?? ""}
                        name="relatedActivityId"
                      >
                        <option value="">Nenhuma atividade relacionada</option>
                        {activities.map((activity) => (
                          <option key={activity.id} value={activity.id}>
                            {activity.title}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                        defaultValue={meeting.relatedLibraryItem?.id ?? ""}
                        name="relatedLibraryItemId"
                      >
                        <option value="">Nenhuma leitura relacionada</option>
                        {libraryItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                      <label className="block">
                        <span className="brand-eyebrow">Participantes</span>
                        <select
                          className="mt-2 min-h-32 w-full rounded-sm border bg-background px-3 py-2 text-sm"
                          defaultValue={meeting.participants.map(
                            (participant) => participant.memberId
                          )}
                          multiple
                          name="memberIds"
                        >
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.displayName} · {member.email}
                            </option>
                          ))}
                        </select>
                        <span className="mt-2 block text-muted-foreground text-xs">
                          Selecione os participantes; sem seleção, a
                          visibilidade segue o curso.
                        </span>
                      </label>
                      <Button size="sm" type="submit">
                        Salvar encontro
                      </Button>
                    </form>
                  </details>
                  {meeting.startsAt <= new Date() &&
                    meeting.participants.length > 0 &&
                    (meeting.status === "PUBLISHED" ||
                      meeting.status === "ARCHIVED") && (
                      <details className="mt-4 border-border border-t pt-4">
                        <summary className="cursor-pointer text-foreground text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          Registrar presença confirmada
                        </summary>
                        <p className="mt-3 max-w-2xl text-muted-foreground text-sm leading-6">
                          Marque quem esteve presente. O registro é feito pela
                          equipe e não é inferido ao abrir o link do encontro.
                        </p>
                        <form
                          action={saveMeetingAttendance}
                          className="mt-4 space-y-4"
                        >
                          <input
                            name="meetingId"
                            type="hidden"
                            value={meeting.id}
                          />
                          <fieldset className="grid gap-2 sm:grid-cols-2">
                            <legend className="sr-only">
                              Participantes de {meeting.title}
                            </legend>
                            {meeting.participants.map(({ memberId }) => {
                              const member = members.find(
                                (candidate) => candidate.id === memberId
                              );
                              if (!member) {
                                return null;
                              }
                              const attendance = meeting.attendance.find(
                                (entry) => entry.memberId === memberId
                              );
                              return (
                                <label
                                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring"
                                  key={memberId}
                                >
                                  <input
                                    className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    defaultChecked={attendance?.isPresent}
                                    name="attendeeIds"
                                    type="checkbox"
                                    value={memberId}
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate text-foreground">
                                      {member.displayName || member.email}
                                    </span>
                                    {attendance && (
                                      <span className="mt-0.5 block text-muted-foreground text-xs">
                                        Registro atualizado em{" "}
                                        {formatDate(
                                          attendance.markedAt,
                                          meeting.timezone
                                        )}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </fieldset>
                          <Button size="sm" type="submit">
                            Salvar presença
                          </Button>
                        </form>
                        {meeting.attendance.some(
                          (entry) =>
                            !meeting.participants.some(
                              ({ memberId }) => memberId === entry.memberId
                            )
                        ) && (
                          <div className="mt-5 border-border border-t pt-4">
                            <p className="brand-eyebrow">
                              Registros de participantes removidos
                            </p>
                            <ul className="mt-2 space-y-2 text-sm">
                              {meeting.attendance
                                .filter(
                                  (entry) =>
                                    !meeting.participants.some(
                                      ({ memberId }) =>
                                        memberId === entry.memberId
                                    )
                                )
                                .map((entry) => (
                                  <li
                                    className="flex flex-wrap justify-between gap-2 text-muted-foreground"
                                    key={entry.memberId}
                                  >
                                    <span>
                                      {entry.member.displayName ||
                                        entry.member.email ||
                                        "Membro"}
                                    </span>
                                    <span>
                                      {entry.isPresent
                                        ? "Presença confirmada"
                                        : "Ausência registrada"}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </details>
                    )}
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Novo encontro</p>
          <form action={createMeeting} className="mt-5 space-y-4">
            <input name="idempotencyKey" type="hidden" value={randomUUID()} />
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
            <label className="block" htmlFor="meeting-activity">
              <span className="brand-eyebrow">
                Atividade relacionada (opcional)
              </span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue=""
                id="meeting-activity"
                name="relatedActivityId"
              >
                <option value="">Nenhuma atividade</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block" htmlFor="meeting-library-item">
              <span className="brand-eyebrow">
                Leitura relacionada (opcional)
              </span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue=""
                id="meeting-library-item"
                name="relatedLibraryItemId"
              >
                <option value="">Nenhuma leitura</option>
                {libraryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block" htmlFor="meeting-recurrence">
              <span className="brand-eyebrow">Recorrência (opcional)</span>
              <Input
                className="mt-2"
                id="meeting-recurrence"
                name="recurrenceRule"
                placeholder="Ex.: semanal"
              />
            </label>
            <label className="block" htmlFor="meeting-members">
              <span className="brand-eyebrow">Participantes (opcional)</span>
              <select
                className="mt-2 min-h-32 w-full rounded-sm border bg-background px-3 py-2 text-sm"
                id="meeting-members"
                multiple
                name="memberIds"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName} · {member.email}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-muted-foreground text-xs">
                Sem participantes, o encontro segue a visibilidade do curso.
              </span>
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
