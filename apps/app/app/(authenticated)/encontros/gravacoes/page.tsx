import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, FileTextIcon, VideoIcon } from "lucide-react";
import Link from "next/link";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { LessonPlayer } from "@/components/learning/lesson-player";
import { requireMemberId } from "@/lib/learning";
import { getMemberProductConfig } from "@/lib/product-config";
import { getMemberRecordingLibrary } from "@/lib/recordings";

export const dynamic = "force-dynamic";

interface RecordingLibraryPageProperties {
  readonly searchParams: Promise<{ asset?: string }>;
}

const recordingHref = (assetId: string) =>
  `/encontros/gravacoes?asset=${encodeURIComponent(assetId)}#asset-${assetId}`;

const RecordingLibraryPage = async ({
  searchParams,
}: RecordingLibraryPageProperties) => {
  const memberId = await requireMemberId();
  const [{ asset: requestedAssetId }, library, productConfig] =
    await Promise.all([
      searchParams,
      getMemberRecordingLibrary(memberId),
      getMemberProductConfig(memberId),
    ]);

  if (!(productConfig.recordingsExperienceV2 || library.access.fullAccess)) {
    return (
      <LearningPageFrame
        description="O arquivo histórico está sendo organizado pela equipe do Interprete. Quando estiver liberado para sua conta, seus encontros aparecerão aqui."
        eyebrow="Encontros · arquivo"
        title="Estamos preparando seus encontros anteriores."
      >
        <section className="paper-surface border p-8 sm:p-12">
          <p className="text-muted-foreground leading-7">
            Enquanto isso, você continua com acesso aos encontros publicados e
            às atividades da sua área de membros.
          </p>
          <Button asChild className="mt-7" variant="outline">
            <Link href="/encontros">
              Voltar para encontros <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </LearningPageFrame>
    );
  }

  return (
    <LearningPageFrame
      description="Um arquivo dos encontros que já aconteceram. Aqui você retoma uma conversa, uma pergunta ou um ponto que merece outra passagem — sem transformar gravação em aula obrigatória."
      eyebrow="Encontros · arquivo"
      title="Seus encontros anteriores."
    >
      {library.access.fullAccess && (
        <p className="border-brand-action/40 border-l-2 bg-brand-action/5 px-4 py-3 text-muted-foreground text-sm leading-6">
          Você está vendo o arquivo completo em modo de equipe. Membros só veem
          grupos explicitamente vinculados a eles.
        </p>
      )}

      {library.groups.length === 0 ? (
        <section className="paper-surface border p-8 sm:p-12">
          <VideoIcon aria-hidden="true" className="size-6 text-brand-action" />
          <p className="brand-eyebrow mt-8">Ainda não há um arquivo seu</p>
          <h2 className="mt-3 font-display text-3xl">
            As gravações aparecerão quando um grupo for liberado para você.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
            O acesso é definido pela equipe do Interprete. Nenhuma gravação de
            outra pessoa é descoberta ou exibida por esta página.
          </p>
          <Button asChild className="mt-7" variant="outline">
            <Link href="/encontros">
              Voltar para encontros <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </section>
      ) : (
        <div className="space-y-12">
          {(() => {
            const selectedRecording =
              library.recordings.find(
                (recording) => recording.asset.id === requestedAssetId
              ) ??
              library.continueWatching[0] ??
              null;

            if (
              !selectedRecording ||
              selectedRecording.asset.kind !== "VIDEO"
            ) {
              return null;
            }

            return (
              <section aria-labelledby="player-heading">
                <div className="border-b pb-4">
                  <p className="brand-eyebrow">Passagem em andamento</p>
                  <h2
                    className="mt-3 font-display text-3xl"
                    id="player-heading"
                  >
                    {selectedRecording.asset.title}
                  </h2>
                  <p className="mt-2 text-muted-foreground text-sm">
                    {selectedRecording.group.legacyStudentName} ·{" "}
                    {selectedRecording.legacyLesson.title}
                  </p>
                </div>
                <div className="paper-surface mt-6 border p-4 sm:p-6">
                  <LessonPlayer
                    assetId={selectedRecording.asset.id}
                    mimeType={selectedRecording.asset.mimeType}
                    persistProgress
                    title={selectedRecording.asset.title}
                  />
                </div>
              </section>
            );
          })()}

          {library.continueWatching.length > 0 && (
            <section aria-labelledby="continue-heading">
              <div className="border-b pb-4">
                <p className="brand-eyebrow">Uma segunda passagem</p>
                <h2
                  className="mt-3 font-display text-3xl"
                  id="continue-heading"
                >
                  Continue assistindo
                </h2>
              </div>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {library.continueWatching.slice(0, 2).map((recording) => (
                  <article
                    className="paper-surface border p-5 sm:p-7"
                    key={recording.asset.id}
                  >
                    <p className="brand-eyebrow">
                      {recording.group.legacyStudentName}
                    </p>
                    <h3 className="mt-3 font-display text-2xl">
                      {recording.asset.title}
                    </h3>
                    <p className="mt-2 text-muted-foreground text-sm">
                      Você parou em {recording.progress?.positionSeconds ?? 0}s.
                    </p>
                    <Button
                      asChild
                      className="mt-6"
                      size="sm"
                      variant="outline"
                    >
                      <Link href={recordingHref(recording.asset.id)}>
                        Retomar gravação <ArrowRightIcon aria-hidden="true" />
                      </Link>
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="groups-heading">
            <div className="border-b pb-4">
              <p className="brand-eyebrow">Arquivo por encontro</p>
              <h2 className="mt-3 font-display text-3xl" id="groups-heading">
                Gravações e materiais
              </h2>
            </div>
            <div className="mt-6 space-y-10">
              {library.groups.map((group) => (
                <section
                  className="border-b pb-8 last:border-b-0"
                  key={group.id}
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                      <p className="brand-eyebrow">{group.legacyStudentName}</p>
                      <h3 className="mt-2 font-display text-3xl">
                        {group.legacyModule.title}
                      </h3>
                      <p className="mt-2 text-muted-foreground text-sm">
                        {group.recordings.length} item
                        {group.recordings.length === 1 ? "" : "s"} preservado
                        {group.recordings.length === 1 ? "" : "s"} do arquivo
                        histórico.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    {group.recordings.map((recording) => (
                      <article
                        className="paper-surface border p-5"
                        id={`asset-${recording.asset.id}`}
                        key={recording.asset.id}
                      >
                        <div className="flex items-start gap-3">
                          {recording.asset.kind === "VIDEO" ? (
                            <VideoIcon
                              aria-hidden="true"
                              className="mt-1 size-5 shrink-0 text-brand-action"
                            />
                          ) : (
                            <FileTextIcon
                              aria-hidden="true"
                              className="mt-1 size-5 shrink-0 text-brand-action"
                            />
                          )}
                          <div className="min-w-0">
                            <h4 className="font-display text-2xl">
                              {recording.asset.title}
                            </h4>
                            <p className="mt-2 font-data text-muted-foreground text-xs uppercase tracking-[0.12em]">
                              {recording.legacyLesson.title}
                            </p>
                          </div>
                        </div>
                        <div className="mt-6">
                          {recording.asset.kind === "VIDEO" ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={recordingHref(recording.asset.id)}>
                                Abrir gravação{" "}
                                <ArrowRightIcon aria-hidden="true" />
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild size="sm" variant="outline">
                              <a
                                href={`/api/learning/assets/${recording.asset.id}`}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Abrir material{" "}
                                <ArrowRightIcon aria-hidden="true" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      )}
    </LearningPageFrame>
  );
};

export default RecordingLibraryPage;
