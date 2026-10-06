import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { LinkIcon, UserRoundIcon, VideoIcon } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/authorization";
import {
  getAdminAssignableMembers,
  getAdminRecordingGroups,
} from "@/lib/recordings";
import {
  assignImportedRecordingGroup,
  revokeImportedRecordingGroup,
} from "./actions";
import { RecordingGroupAssignmentForm } from "./recording-group-assignment-form";
import { RecordingThumbnailUploader } from "./recording-thumbnail-uploader";

interface RecordingsAdminPageProperties {
  readonly searchParams: Promise<{ status?: string; message?: string }>;
}

const RecordingsAdminPage = async ({
  searchParams,
}: RecordingsAdminPageProperties) => {
  await requireAdmin();
  const [{ status, message }, groups, members] = await Promise.all([
    searchParams,
    getAdminRecordingGroups(),
    getAdminAssignableMembers(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="max-w-3xl">
        <p className="brand-eyebrow">Professor · arquivo histórico</p>
        <span aria-hidden="true" className="brand-rule mt-4" />
        <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          Gravações importadas.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Um grupo histórico libera todas as gravações e anexos daquela pessoa.
          Só vincule a conta depois de verificar a identidade por uma fonte
          confiável; o nome vindo da Kiwify, sozinho, não autoriza o acesso.
          Cada decisão fica registrada no histórico administrativo.
        </p>
      </header>

      {message && (
        <p
          className={`mt-8 border px-4 py-3 text-sm ${status === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-brand-action/40 bg-brand-action/5 text-foreground"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      <section aria-labelledby="groups-heading" className="mt-12 space-y-6">
        <div className="flex items-end justify-between border-b pb-3">
          <div>
            <p className="brand-eyebrow">Acesso administrativo</p>
            <h2 className="mt-2 font-display text-3xl" id="groups-heading">
              {groups.length} grupos preservados
            </h2>
          </div>
          <Link
            className="text-muted-foreground text-sm underline underline-offset-4"
            href="/encontros/gravacoes"
          >
            Abrir arquivo
          </Link>
        </div>

        {groups.length === 0 ? (
          <p className="paper-surface border p-8 text-muted-foreground">
            Nenhum grupo histórico foi indexado ainda.
          </p>
        ) : (
          groups.map((group) => {
            const videoCount = group.recordings.filter(
              ({ asset }) => asset.kind === "VIDEO"
            ).length;
            const attachmentCount = group.recordings.length - videoCount;
            const memberLabel =
              group.member?.profile?.displayName ??
              group.member?.displayName ??
              group.member?.profile?.username;

            return (
              <article
                className="paper-surface border p-6 sm:p-8"
                key={group.id}
              >
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={group.memberId ? "default" : "outline"}>
                        {group.memberId ? "Vinculado" : "Sem vínculo"}
                      </Badge>
                      <span className="font-data text-muted-foreground text-xs uppercase tracking-[0.12em]">
                        {group.sourcePlatform}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-3xl">
                      {group.legacyStudentName}
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      {group.legacyModule.title} ·{" "}
                      {group.legacyModule.course.title}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 text-muted-foreground text-sm">
                      <span className="inline-flex items-center gap-2">
                        <VideoIcon aria-hidden="true" className="size-4" />{" "}
                        {videoCount} gravações
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <LinkIcon aria-hidden="true" className="size-4" />{" "}
                        {attachmentCount} anexos
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <UserRoundIcon aria-hidden="true" className="size-4" />{" "}
                        {memberLabel ?? "nenhum membro"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full max-w-md border-brand-action/40 border-l-2 pl-5 text-sm leading-6 lg:w-96">
                    <p className="font-medium">Origem preservada</p>
                    <p className="mt-1 break-all text-muted-foreground">
                      {group.sourceId}
                    </p>
                    <p className="mt-3 text-muted-foreground">
                      A associação abaixo altera apenas autorização de leitura.
                      Os assets e caminhos do Storage não são movidos.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 border-t pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
                  <RecordingGroupAssignmentForm
                    action={assignImportedRecordingGroup}
                    attachmentCount={attachmentCount}
                    defaultMemberId={group.memberId}
                    groupId={group.id}
                    members={members}
                    recordingCount={videoCount}
                  />
                  <div className="space-y-4">
                    {group.memberId ? (
                      <form action={revokeImportedRecordingGroup}>
                        <input name="groupId" type="hidden" value={group.id} />
                        <Button type="submit" variant="outline">
                          Revogar acesso
                        </Button>
                      </form>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Sem acesso de membro enquanto não houver confirmação.
                      </p>
                    )}
                    {group.assignments.length > 0 && (
                      <div>
                        <p className="brand-eyebrow">Histórico recente</p>
                        <ul className="mt-2 space-y-1 text-muted-foreground text-xs">
                          {group.assignments.slice(0, 3).map((assignment) => (
                            <li key={assignment.id}>
                              <p>
                                {assignment.action.toLowerCase()} ·{" "}
                                {assignment.createdAt.toLocaleDateString(
                                  "pt-BR"
                                )}
                              </p>
                              {assignment.note ? (
                                <p className="mt-1 max-w-prose leading-5">
                                  Evidência: {assignment.note}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <details className="mt-8 border-t pt-6">
                  <summary className="cursor-pointer font-data text-muted-foreground text-xs uppercase tracking-[0.12em]">
                    Capas das gravações · {group.recordings.length} itens
                  </summary>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {group.recordings.map((recording) => (
                      <div className="space-y-3 border p-4" key={recording.id}>
                        <p className="font-display text-lg">
                          {recording.originalTitle ?? recording.asset.title}
                        </p>
                        <RecordingThumbnailUploader
                          recordingId={recording.id}
                          thumbnailPath={recording.thumbnailPath}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
};

export default RecordingsAdminPage;
