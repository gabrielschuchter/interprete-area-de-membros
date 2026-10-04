import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  FileTextIcon,
  SearchIcon,
  VideoIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { LessonPlayer } from "@/components/learning/lesson-player";
import { requireMemberId } from "@/lib/learning";
import {
  getMemberContinueWatching,
  getMemberRecordingPage,
} from "@/lib/recordings";

export const dynamic = "force-dynamic";

interface RecordingLibraryPageProperties {
  readonly searchParams: Promise<{
    asset?: string;
    cursor?: string;
    q?: string;
    year?: string;
  }>;
}

const recordingHref = (assetId: string) =>
  `/encontros/gravacoes?asset=${encodeURIComponent(assetId)}#asset-${assetId}`;

const formatDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(value)
    : "Data do encontro não informada";

const formatDuration = (seconds: number | null) => {
  if (!seconds) {
    return null;
  }
  return `${Math.max(1, Math.round(seconds / 60))} min`;
};

const RecordingThumbnail = ({
  alt,
  src,
}: {
  readonly alt: string;
  readonly src: string | null;
}) => (
  <div className="relative aspect-[16/9] overflow-hidden border bg-brand-structural/10">
    {src ? (
      <Image
        alt={alt}
        className="size-full object-cover object-center"
        height={360}
        loading="lazy"
        sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
        src={src}
        unoptimized
        width={640}
      />
    ) : (
      <div className="flex size-full flex-col justify-between bg-[linear-gradient(135deg,rgba(91,13,61,0.96),rgba(143,29,64,0.78))] p-5 text-primary-foreground">
        <VideoIcon aria-hidden="true" className="size-6" />
        <span className="font-data text-[10px] uppercase tracking-[0.18em]">
          Encontro preservado
        </span>
      </div>
    )}
  </div>
);

const RecordingLibraryPage = async ({
  searchParams,
}: RecordingLibraryPageProperties) => {
  const memberId = await requireMemberId();
  const params = await searchParams;
  const [{ asset, q, year }, page, continueData] = await Promise.all([
    Promise.resolve(params),
    getMemberRecordingPage(memberId, {
      cursor: params.cursor,
      query: params.q,
      requestedAssetId: params.asset,
      year: params.year,
    }),
    getMemberContinueWatching(memberId),
  ]);

  const selectedRecording =
    page.requestedRecording ??
    continueData.continueWatching.find(
      (recording) => recording.asset.id === asset
    ) ??
    continueData.continueWatching[0] ??
    null;
  const currentRows = page.recordings;
  const yearOptions = Array.from(
    new Set(
      currentRows
        .map((recording) => recording.meetingDate?.getFullYear())
        .filter((value): value is number => Boolean(value))
    )
  ).sort((left, right) => right - left);
  const groupedRows = currentRows.reduce<Map<string, typeof currentRows>>(
    (groups, recording) => {
      const key = recording.meetingDate
        ? String(recording.meetingDate.getFullYear())
        : "Data não informada";
      groups.set(key, [...(groups.get(key) ?? []), recording]);
      return groups;
    },
    new Map()
  );
  const nextHref = page.nextCursor
    ? `/encontros/gravacoes?${new URLSearchParams({
        ...(q ? { q } : {}),
        ...(year ? { year } : {}),
        cursor: page.nextCursor,
      }).toString()}`
    : null;

  return (
    <LearningPageFrame
      description="Um arquivo dos encontros que já aconteceram. Aqui você retoma uma conversa, uma pergunta ou um ponto que merece outra passagem — sem transformar gravação em aula obrigatória."
      eyebrow="Aprender · arquivo pessoal"
      title="Minhas gravações."
    >
      {page.access.fullAccess && (
        <p className="border-brand-action/40 border-l-2 bg-brand-action/5 px-4 py-3 text-muted-foreground text-sm leading-6">
          Você está vendo o arquivo completo em modo de equipe. Membros só veem
          grupos explicitamente vinculados a eles.
        </p>
      )}

      <form
        className="mt-8 flex flex-col gap-3 border-y py-4 sm:flex-row"
        method="get"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar gravações</span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-11 w-full border bg-background pr-3 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={q ?? ""}
            name="q"
            placeholder="Buscar por título ou grupo"
            type="search"
          />
        </label>
        <label>
          <span className="sr-only">Filtrar por ano</span>
          <select
            className="h-11 w-full border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48"
            defaultValue={year ?? ""}
            name="year"
          >
            <option value="">Todos os anos</option>
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        {(q || year) && (
          <Button asChild type="button" variant="ghost">
            <Link href="/encontros/gravacoes">Limpar</Link>
          </Button>
        )}
      </form>

      {selectedRecording && selectedRecording.asset.kind === "VIDEO" && (
        <section aria-labelledby="player-heading" className="mt-10">
          <div className="border-b pb-4">
            <p className="brand-eyebrow">Passagem em andamento</p>
            <h2 className="mt-3 font-display text-3xl" id="player-heading">
              {selectedRecording.asset.title}
            </h2>
            <p className="mt-2 text-muted-foreground text-sm">
              {selectedRecording.group.legacyStudentName} ·{" "}
              {selectedRecording.legacyLesson.title}
            </p>
          </div>
          <div className="paper-surface mt-6 border p-3 sm:p-6">
            <LessonPlayer
              assetId={selectedRecording.asset.id}
              mediaExternalId={selectedRecording.asset.mediaExternalId}
              mediaProvider={selectedRecording.asset.mediaProvider}
              mimeType={selectedRecording.asset.mimeType}
              persistProgress
              studyActivityKind="RECORDING"
              studyResourceId={selectedRecording.asset.id}
              title={selectedRecording.asset.title}
            />
          </div>
        </section>
      )}

      {continueData.continueWatching.length > 0 && (
        <section aria-labelledby="continue-heading" className="mt-12">
          <div className="border-b pb-4">
            <p className="brand-eyebrow">Uma segunda passagem</p>
            <h2 className="mt-3 font-display text-3xl" id="continue-heading">
              Continue assistindo
            </h2>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {continueData.continueWatching.map((recording) => (
              <article
                className="paper-surface overflow-hidden border"
                key={recording.asset.id}
              >
                <RecordingThumbnail
                  alt={recording.asset.title}
                  src={recording.thumbnailUrl}
                />
                <div className="p-5">
                  <p className="brand-eyebrow">
                    {recording.group.legacyStudentName}
                  </p>
                  <h3 className="mt-3 font-display text-2xl">
                    {recording.asset.title}
                  </h3>
                  <p className="mt-2 text-muted-foreground text-sm">
                    Você parou em{" "}
                    {formatDuration(recording.progress.positionSeconds) ??
                      `${recording.progress.positionSeconds}s`}
                    .
                  </p>
                  <Button asChild className="mt-5" size="sm" variant="outline">
                    <Link href={recordingHref(recording.asset.id)}>
                      Retomar gravação <ArrowRightIcon aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="archive-heading" className="mt-14">
        <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="brand-eyebrow">Arquivo preservado</p>
            <h2 className="mt-3 font-display text-3xl" id="archive-heading">
              Gravações e materiais
            </h2>
          </div>
          <p className="text-muted-foreground text-sm">
            {currentRows.length} item{currentRows.length === 1 ? "" : "s"}
            {page.hasMore ? " nesta página" : ""}
          </p>
        </div>

        {groupedRows.size === 0 ? (
          <section className="paper-surface mt-6 border p-8 sm:p-12">
            <VideoIcon
              aria-hidden="true"
              className="size-6 text-brand-action-text"
            />
            <p className="brand-eyebrow mt-8">Ainda não há um arquivo seu</p>
            <h3 className="mt-3 font-display text-3xl">
              As gravações aparecerão quando um grupo for liberado para você.
            </h3>
            <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
              O acesso é definido pela equipe do Interprete. Nenhuma gravação de
              outra pessoa é descoberta ou exibida por esta página.
            </p>
          </section>
        ) : (
          <div className="mt-8 space-y-12">
            {Array.from(groupedRows.entries()).map(([groupLabel, rows]) => (
              <section key={groupLabel}>
                <div className="flex items-end justify-between border-b pb-3">
                  <h3 className="font-display text-2xl">{groupLabel}</h3>
                  <span className="font-data text-muted-foreground text-xs">
                    {rows.length.toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((recording) => (
                    <article
                      className="paper-surface overflow-hidden border"
                      id={`asset-${recording.asset.id}`}
                      key={recording.id}
                    >
                      <RecordingThumbnail
                        alt={recording.asset.title}
                        src={recording.thumbnailUrl}
                      />
                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          {recording.asset.kind === "VIDEO" ? (
                            <VideoIcon
                              aria-hidden="true"
                              className="mt-1 size-5 shrink-0 text-brand-action-text"
                            />
                          ) : (
                            <FileTextIcon
                              aria-hidden="true"
                              className="mt-1 size-5 shrink-0 text-brand-action-text"
                            />
                          )}
                          <div className="min-w-0">
                            <h4 className="font-display text-2xl">
                              {recording.asset.title}
                            </h4>
                            <p className="mt-2 font-data text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                              {formatDate(recording.meetingDate)} ·{" "}
                              {recording.legacyLesson.title}
                            </p>
                          </div>
                        </div>
                        {recording.asset.kind === "VIDEO" ? (
                          <Button
                            asChild
                            className="mt-6"
                            size="sm"
                            variant="outline"
                          >
                            <Link href={recordingHref(recording.asset.id)}>
                              Abrir gravação{" "}
                              <ArrowRightIcon aria-hidden="true" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            asChild
                            className="mt-6"
                            size="sm"
                            variant="outline"
                          >
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
        )}

        {nextHref && (
          <div className="mt-10 flex justify-center">
            <Button asChild variant="outline">
              <Link href={nextHref}>Carregar mais gravações</Link>
            </Button>
          </div>
        )}
      </section>
    </LearningPageFrame>
  );
};

export default RecordingLibraryPage;
