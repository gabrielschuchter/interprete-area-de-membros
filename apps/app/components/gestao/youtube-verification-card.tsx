"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  PlayIcon,
  RadioTowerIcon,
  RotateCwIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { verifyGestaoYouTubeVideo } from "@/app/(authenticated)/gestao/ensino/cursos/actions";
import type {
  YouTubeVerificationResult,
  YouTubeVerificationStatus,
} from "@/lib/youtube-verification";
import { safeYouTubeThumbnailUrl } from "@/lib/youtube-verification";

const YouTubeLessonPlayer = dynamic(
  () =>
    import("@/components/learning/youtube-lesson-player").then(
      (module) => module.YouTubeLessonPlayer
    ),
  {
    loading: () => (
      <div aria-busy="true" className="gestao-youtube-player-loading">
        Carregando prévia do vídeo…
      </div>
    ),
  }
);

const statusCopy: Record<
  YouTubeVerificationStatus,
  { readonly detail: string; readonly title: string; readonly tone: string }
> = {
  UNLISTED: {
    title: "Vídeo encontrado · Não listado",
    detail: "Apenas quem tem o link consegue encontrá-lo no YouTube.",
    tone: "success",
  },
  PUBLIC: {
    title: "Este vídeo é público",
    detail:
      "Qualquer pessoa pode encontrá-lo no YouTube. Recomendamos “Não listado”.",
    tone: "warning",
  },
  PRIVATE_OR_NOT_FOUND: {
    title: "Vídeo privado ou não encontrado",
    detail: "Confira o link ou altere a visibilidade para “Não listado”.",
    tone: "error",
  },
  EMBEDDING_DISABLED: {
    title: "Incorporação desativada pelo dono do vídeo",
    detail: "Ative “Permitir incorporação” nas configurações do vídeo.",
    tone: "error",
  },
  INVALID: {
    title: "Esse não parece um link do YouTube",
    detail: "Cole um link como youtu.be/… ou youtube.com/watch?v=…",
    tone: "error",
  },
  UNREACHABLE: {
    title: "Não foi possível verificar agora",
    detail:
      "O YouTube não respondeu. Você pode salvar como rascunho e verificar de novo em breve.",
    tone: "warning",
  },
  NOT_CONFIGURED: {
    title: "Verificação do YouTube não configurada",
    detail:
      "Adicione YOUTUBE_API_KEY no ambiente de QA para verificar este vídeo.",
    tone: "warning",
  },
};

interface YouTubeVerificationCardProperties {
  readonly assetId: string;
  readonly endAtSeconds?: number | null;
  readonly initialCaptionsAvailable: boolean | null;
  readonly initialDurationSeconds: number | null;
  readonly initialStatus: YouTubeVerificationStatus | null;
  readonly initialThumbnailUrl: string | null;
  readonly initialTitle: string | null;
  readonly initialVideoId: string | null;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly onUseTitle?: (title: string) => void;
  readonly startAtSeconds?: number | null;
  readonly youtubeUrl: string;
}

const formatDuration = (seconds: number | null) => {
  if (seconds === null) {
    return null;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const iconForStatus = (status: YouTubeVerificationStatus) => {
  if (status === "UNLISTED") {
    return CircleCheckIcon;
  }
  if (status === "PRIVATE_OR_NOT_FOUND") {
    return LockKeyholeIcon;
  }
  if (status === "NOT_CONFIGURED") {
    return CircleHelpIcon;
  }
  if (status === "UNREACHABLE") {
    return RadioTowerIcon;
  }
  return CircleAlertIcon;
};

const VerificationMessage = ({
  captionsAvailable,
  durationSeconds,
  pending,
  requestError,
  result,
  status,
}: {
  readonly captionsAvailable: boolean | null;
  readonly durationSeconds: number | null;
  readonly pending: boolean;
  readonly requestError: boolean;
  readonly result: YouTubeVerificationResult | null;
  readonly status: YouTubeVerificationStatus | null;
}) => {
  if (pending) {
    return (
      <output
        aria-live="polite"
        className="gestao-youtube-state"
        data-tone="pending"
      >
        <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        <span>
          <strong>Verificando o vídeo…</strong>
          <small>Conferindo visibilidade, duração e incorporação.</small>
        </span>
      </output>
    );
  }
  if (!status) {
    return null;
  }

  const copy = statusCopy[status];
  const StatusIcon = iconForStatus(status);
  let captionCopy = "";
  if (captionsAvailable === true) {
    captionCopy = " · Legendas disponíveis";
  } else if (captionsAvailable === false) {
    captionCopy = " · Sem legendas informadas";
  }

  return (
    <output
      aria-live={copy.tone === "error" ? "assertive" : "polite"}
      className="gestao-youtube-state"
      data-tone={copy.tone}
    >
      <StatusIcon aria-hidden="true" />
      <span>
        <strong>{copy.title}</strong>
        <small>
          {copy.detail}
          {requestError ? " Tente novamente daqui a pouco." : ""}
        </small>
        {result?.source === "DEVELOPMENT" ? (
          <small className="gestao-youtube-source">
            Simulação local de desenvolvimento; não consultou o YouTube.
          </small>
        ) : null}
        {durationSeconds !== null ? (
          <small>
            Duração {formatDuration(durationSeconds)}
            {captionCopy}
          </small>
        ) : null}
      </span>
    </output>
  );
};

const VideoPreview = ({
  assetId,
  durationSeconds,
  endAtSeconds,
  initialVideoId,
  lessonTitle,
  metadata,
  onUseTitle,
  result,
  startAtSeconds,
  status,
  thumbnailUrl: rawThumbnailUrl,
  title,
}: {
  readonly assetId: string;
  readonly durationSeconds: number | null;
  readonly endAtSeconds: number | null;
  readonly initialVideoId: string | null;
  readonly lessonTitle: string;
  readonly metadata: YouTubeVerificationResult["metadata"];
  readonly onUseTitle?: (title: string) => void;
  readonly result: YouTubeVerificationResult | null;
  readonly startAtSeconds: number | null;
  readonly status: YouTubeVerificationStatus | null;
  readonly thumbnailUrl: string | null;
  readonly title: string;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const videoId = result?.videoId ?? initialVideoId;
  const thumbnailUrl = safeYouTubeThumbnailUrl(rawThumbnailUrl ?? undefined);
  const canPreview = status === "UNLISTED" || status === "PUBLIC";

  if (!(canPreview && videoId)) {
    return null;
  }

  return (
    <>
      <div className="gestao-youtube-preview">
        <div
          aria-hidden="true"
          className="gestao-youtube-thumbnail"
          style={
            thumbnailUrl
              ? { backgroundImage: `url("${thumbnailUrl}")` }
              : undefined
          }
        />
        <div className="gestao-youtube-preview-copy">
          <strong>{title || lessonTitle}</strong>
          {result?.source === "DEVELOPMENT" ? (
            <span>Fonte: adaptador de desenvolvimento</span>
          ) : null}
          <div className="gestao-youtube-preview-actions">
            {metadata?.title && onUseTitle ? (
              <Button
                onClick={() => onUseTitle(metadata.title)}
                size="sm"
                type="button"
                variant="outline"
              >
                Usar o título do vídeo
              </Button>
            ) : null}
            <Button
              onClick={() => {
                dialogRef.current?.showModal();
                setPreviewOpen(true);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <PlayIcon aria-hidden="true" /> Testar como aluno
            </Button>
          </div>
        </div>
        {durationSeconds !== null ? (
          <span className="gestao-youtube-duration">
            {formatDuration(durationSeconds)}
          </span>
        ) : null}
      </div>
      <dialog
        aria-labelledby={`youtube-preview-title-${assetId}`}
        className="gestao-youtube-dialog"
        id={`youtube-preview-dialog-${assetId}`}
        onClose={() => setPreviewOpen(false)}
        ref={dialogRef}
      >
        <div className="gestao-youtube-dialog-head">
          <h2 id={`youtube-preview-title-${assetId}`}>Prévia como aluno</h2>
          <button
            aria-label="Fechar prévia"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            Fechar
          </button>
        </div>
        {previewOpen ? (
          <YouTubeLessonPlayer
            assetId={assetId}
            endAtSeconds={endAtSeconds}
            persistProgress={false}
            startAtSeconds={startAtSeconds}
            title={title || lessonTitle}
            videoId={videoId}
          />
        ) : null}
      </dialog>
    </>
  );
};

export const YouTubeVerificationCard = ({
  assetId,
  initialStatus,
  initialTitle,
  initialThumbnailUrl,
  initialDurationSeconds,
  initialCaptionsAvailable,
  initialVideoId,
  startAtSeconds = null,
  endAtSeconds = null,
  lessonId,
  lessonTitle,
  onUseTitle,
  youtubeUrl,
}: YouTubeVerificationCardProperties) => {
  const [input, setInput] = useState(youtubeUrl);
  const [status, setStatus] = useState<YouTubeVerificationStatus | null>(
    initialStatus
  );
  const [result, setResult] = useState<YouTubeVerificationResult | null>(null);
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const metadata = result?.metadata;
  const title = metadata?.title ?? initialTitle ?? lessonTitle;
  const thumbnailUrl = metadata?.thumbnailUrl ?? initialThumbnailUrl;
  const durationSeconds = metadata?.durationSeconds ?? initialDurationSeconds;
  const captionsAvailable =
    metadata?.captionsAvailable ?? initialCaptionsAvailable;

  const verify = async () => {
    setPending(true);
    setStatus("UNREACHABLE");
    setRequestError(false);
    setResult(null);
    try {
      const verified = await verifyGestaoYouTubeVideo(lessonId, input);
      setResult(verified);
      setStatus(verified.status);
    } catch {
      setRequestError(true);
      setStatus("UNREACHABLE");
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-label="Verificação do vídeo" className="gestao-youtube-field">
      <div className="gestao-youtube-label">
        Link do vídeo no YouTube <span aria-hidden="true">*</span>
      </div>
      <div className="gestao-youtube-input-row">
        <Input
          aria-label="Link do vídeo no YouTube"
          autoComplete="url"
          name="youtubeUrl"
          onChange={(event) => {
            setInput(event.target.value);
            setStatus(null);
            setResult(null);
            setRequestError(false);
          }}
          placeholder="Cole o link do vídeo (não listado)"
          type="url"
          value={input}
        />
        <Button
          aria-busy={pending}
          disabled={pending || input.trim().length === 0}
          onClick={verify}
          type="button"
          variant="outline"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <RotateCwIcon aria-hidden="true" />
          )}
          Verificar
        </Button>
      </div>

      <VerificationMessage
        captionsAvailable={captionsAvailable}
        durationSeconds={durationSeconds}
        pending={pending}
        requestError={requestError}
        result={result}
        status={status}
      />
      <VideoPreview
        assetId={assetId}
        durationSeconds={durationSeconds}
        endAtSeconds={endAtSeconds}
        initialVideoId={initialVideoId}
        lessonTitle={lessonTitle}
        metadata={metadata ?? null}
        onUseTitle={onUseTitle}
        result={result}
        startAtSeconds={startAtSeconds}
        status={status}
        thumbnailUrl={thumbnailUrl}
        title={title}
      />
    </section>
  );
};
