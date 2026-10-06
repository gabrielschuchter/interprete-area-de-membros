import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { recordingArchiveHref } from "@/lib/recording-navigation";
import { resolveYoutubePlayback } from "@/lib/youtube-video";

interface RecordingArchiveActionProperties {
  readonly assetId: string;
  readonly isVideo: boolean;
  readonly mediaExternalId?: string | null;
  readonly mediaProvider?: string | null;
}

export const RecordingArchiveAction = ({
  assetId,
  isVideo,
  mediaExternalId,
  mediaProvider,
}: RecordingArchiveActionProperties) => {
  const playback = resolveYoutubePlayback(mediaProvider, mediaExternalId);
  if (isVideo && playback.kind === "pending") {
    return (
      <output
        aria-live="polite"
        className="mt-6 border-brand-action/40 border-l-2 bg-brand-action/5 px-3 py-2 text-muted-foreground text-sm leading-5"
      >
        Reprodução pendente: a fonte do vídeo original ainda não está associada.
      </output>
    );
  }

  if (isVideo) {
    const href = `${recordingArchiveHref({ asset: assetId })}#asset-${encodeURIComponent(assetId)}`;
    return (
      <Button asChild className="mt-6" size="sm" variant="outline">
        <Link href={href}>
          Abrir gravação <ArrowRightIcon aria-hidden="true" />
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild className="mt-6" size="sm" variant="outline">
      <a
        href={`/api/learning/assets/${encodeURIComponent(assetId)}`}
        rel="noreferrer"
        target="_blank"
      >
        Abrir material <ArrowRightIcon aria-hidden="true" />
      </a>
    </Button>
  );
};
