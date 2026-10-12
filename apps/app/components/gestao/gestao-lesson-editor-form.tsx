"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { JSONContent } from "@tiptap/core";
import dynamic from "next/dynamic";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type GestaoLessonSaveState,
  saveGestaoLesson,
} from "@/app/(authenticated)/gestao/ensino/cursos/actions";
import { isYouTubeVerificationStatus } from "@/lib/youtube-verification";
import { GestaoLessonVideoUpload } from "./gestao-lesson-video-upload";
import { YouTubeVerificationCard } from "./youtube-verification-card";

const TopicEditor = dynamic(
  () =>
    import("@/components/community/topic-editor").then(
      (module) => module.TopicEditor
    ),
  {
    loading: () => (
      <div aria-busy="true" className="gl-lesson-editor-loading">
        Carregando editor de texto…
      </div>
    ),
  }
);

interface GestaoLessonEditorFormProperties {
  readonly asset: {
    readonly durationSeconds: number | null;
    readonly externalUrl: string | null;
    readonly hasStoredAsset: boolean;
    readonly id: string;
    readonly mediaExternalId: string | null;
    readonly mediaProvider: "STORAGE" | "YOUTUBE" | "EXTERNAL_URL";
    readonly updatedAt: Date;
    readonly youtubeCaptionsAvailable: boolean | null;
    readonly youtubeEndAtSeconds: number | null;
    readonly youtubeSourceUrl: string | null;
    readonly youtubeStartAtSeconds: number | null;
    readonly youtubeThumbnailUrl: string | null;
    readonly youtubeVerificationStatus: string | null;
    readonly youtubeVideoTitle: string | null;
  } | null;
  readonly courseId: string;
  readonly initialIdempotencyKey: string;
  readonly lesson: {
    readonly content: JSONContent;
    readonly description: string | null;
    readonly id: string;
    readonly kind: "TEXT" | "VIDEO" | "READING" | "MIXED" | "MATERIAL";
    readonly objectives: string[];
    readonly slug: string;
    readonly title: string;
    readonly updatedAt: Date;
  };
  readonly maxVideoUploadBytes: number;
  readonly memberId: string;
  readonly pendingUpload: {
    readonly expiresAt: string;
    readonly fileName: string;
    readonly id: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly status: "PENDING" | "READY";
  } | null;
}

const providerOptions = [
  { label: "YouTube (recomendado)", value: "YOUTUBE" },
  { label: "Enviar arquivo", value: "STORAGE" },
] as const;

const integerPattern = /^\d+$/;

const validSeconds = (rawValue: string) => {
  if (!integerPattern.test(rawValue)) {
    return null;
  }
  const value = Number(rawValue);
  return value <= 86_400 ? value : null;
};

const LessonBasics = ({
  lesson,
  onTitleChange,
  title,
}: {
  readonly lesson: GestaoLessonEditorFormProperties["lesson"];
  readonly onTitleChange: (value: string) => void;
  readonly title: string;
}) => (
  <>
    <label className="gl-lesson-field" htmlFor="gestao-lesson-title">
      <span>
        Título <b aria-hidden="true">*</b>
      </span>
      <Input
        autoComplete="off"
        id="gestao-lesson-title"
        maxLength={180}
        name="title-visible"
        onChange={(event) => onTitleChange(event.target.value)}
        required
        value={title}
      />
    </label>
    <label className="gl-lesson-field" htmlFor="gestao-lesson-slug">
      <span>Endereço da aula</span>
      <Input
        defaultValue={lesson.slug}
        id="gestao-lesson-slug"
        name="slug"
        required
      />
    </label>
    <label className="gl-lesson-field" htmlFor="gestao-lesson-kind">
      <span>Tipo</span>
      <select
        className="gl-lesson-select"
        defaultValue={lesson.kind}
        id="gestao-lesson-kind"
        name="kind"
      >
        <option value="VIDEO">Vídeo</option>
        <option value="TEXT">Texto</option>
        <option value="MATERIAL">Arquivo</option>
        <option value="READING">Leitura</option>
        <option value="MIXED">Misto</option>
      </select>
    </label>
  </>
);

const YouTubeFields = ({
  asset,
  endAt,
  lesson,
  onEndAtChange,
  onStartAtChange,
  onTitleChange,
  startAt,
}: {
  readonly asset: GestaoLessonEditorFormProperties["asset"];
  readonly endAt: string;
  readonly lesson: GestaoLessonEditorFormProperties["lesson"];
  readonly onEndAtChange: (value: string) => void;
  readonly onStartAtChange: (value: string) => void;
  readonly onTitleChange: (title: string) => void;
  readonly startAt: string;
}) => (
  <>
    <div className="gl-lesson-info">
      <span aria-hidden="true">ⓘ</span>
      <p>
        <strong>Como funciona:</strong> envie o vídeo ao YouTube como{" "}
        <strong>Não listado</strong> e cole o link aqui. O aluno assiste dentro
        do Interprete.
      </p>
    </div>
    <YouTubeVerificationCard
      assetId={asset?.id ?? lesson.id}
      endAtSeconds={validSeconds(endAt)}
      initialCaptionsAvailable={asset?.youtubeCaptionsAvailable ?? null}
      initialDurationSeconds={asset?.durationSeconds ?? null}
      initialStatus={
        isYouTubeVerificationStatus(asset?.youtubeVerificationStatus)
          ? asset.youtubeVerificationStatus
          : null
      }
      initialThumbnailUrl={asset?.youtubeThumbnailUrl ?? null}
      initialTitle={asset?.youtubeVideoTitle ?? null}
      initialVideoId={asset?.mediaExternalId ?? null}
      lessonId={lesson.id}
      lessonTitle={lesson.title}
      onUseTitle={onTitleChange}
      startAtSeconds={validSeconds(startAt)}
      youtubeUrl={
        asset?.youtubeSourceUrl ??
        (asset?.mediaExternalId
          ? `https://youtu.be/${asset.mediaExternalId}`
          : "")
      }
    />
    <div className="gl-lesson-time-fields">
      <label className="gl-lesson-field" htmlFor="gestao-youtube-start">
        <span>Começar em</span>
        <Input
          id="gestao-youtube-start"
          max={86_400}
          min={0}
          name="youtubeStartAtSeconds"
          onChange={(event) => onStartAtChange(event.target.value)}
          type="number"
          value={startAt}
        />
        <small>Opcional</small>
      </label>
      <label className="gl-lesson-field" htmlFor="gestao-youtube-end">
        <span>Terminar em</span>
        <Input
          id="gestao-youtube-end"
          max={86_400}
          min={0}
          name="youtubeEndAtSeconds"
          onChange={(event) => onEndAtChange(event.target.value)}
          placeholder={
            asset?.durationSeconds
              ? String(asset.durationSeconds)
              : "Duração do vídeo"
          }
          type="number"
          value={endAt}
        />
        <small>Opcional</small>
      </label>
    </div>
  </>
);

const LessonTextFields = ({
  description,
  objectives,
}: {
  readonly description: string | null;
  readonly objectives: string[];
}) => (
  <>
    <label className="gl-lesson-field" htmlFor="gestao-lesson-description">
      <span>Descrição</span>
      <Textarea
        defaultValue={description ?? ""}
        id="gestao-lesson-description"
        maxLength={5000}
        name="description"
        placeholder="Apresente o conteúdo desta aula"
        rows={3}
      />
    </label>
    <label className="gl-lesson-field" htmlFor="gestao-lesson-objectives">
      <span>Objetivos</span>
      <Textarea
        defaultValue={objectives.join("\n")}
        id="gestao-lesson-objectives"
        name="objectives"
        placeholder="Um objetivo por linha"
        rows={2}
      />
    </label>
  </>
);

const ProviderSelector = ({
  asset,
  onChange,
  value,
}: {
  readonly asset: GestaoLessonEditorFormProperties["asset"];
  readonly onChange: (provider: "STORAGE" | "YOUTUBE" | "EXTERNAL_URL") => void;
  readonly value: "STORAGE" | "YOUTUBE" | "EXTERNAL_URL";
}) => {
  const options =
    asset?.mediaProvider === "EXTERNAL_URL"
      ? [
          ...providerOptions,
          { label: "URL externa", value: "EXTERNAL_URL" as const },
        ]
      : providerOptions;

  return (
    <fieldset className="gl-lesson-field gl-lesson-provider-field">
      <legend>De onde vem o vídeo</legend>
      <div className="gl-lesson-source-switch">
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={value === option.value ? "is-active" : ""}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
};

const ExternalUrlField = ({
  initialValue,
}: {
  readonly initialValue: string;
}) => (
  <label className="gl-lesson-field" htmlFor="gestao-external-video-url">
    <span>URL do vídeo externo</span>
    <Input
      defaultValue={initialValue}
      id="gestao-external-video-url"
      name="externalUrl"
      placeholder="https://…"
      type="url"
    />
  </label>
);

const SaveFeedback = ({
  message,
  status,
}: {
  readonly message: string;
  readonly status: GestaoLessonSaveState["status"];
}) =>
  message ? (
    <output
      aria-live={status === "conflict" ? "assertive" : "polite"}
      className={`gl-lesson-save-message is-${status}`}
    >
      {message}
    </output>
  ) : null;

export const GestaoLessonEditorForm = ({
  asset,
  courseId,
  initialIdempotencyKey,
  lesson,
  maxVideoUploadBytes,
  memberId,
  pendingUpload,
}: GestaoLessonEditorFormProperties) => {
  const initialState: GestaoLessonSaveState = {
    assetExpectedUpdatedAt: asset?.updatedAt.toISOString() ?? "",
    assetId: asset?.id ?? null,
    expectedUpdatedAt: lesson.updatedAt.toISOString(),
    idempotencyKey: initialIdempotencyKey,
    message: "",
    status: "idle",
  };
  const [state, formAction, pending] = useActionState(
    saveGestaoLesson,
    initialState
  );
  const contentInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(lesson.title);
  const [provider, setProvider] = useState<
    "STORAGE" | "YOUTUBE" | "EXTERNAL_URL"
  >(asset?.mediaProvider ?? "YOUTUBE");
  const [startAt, setStartAt] = useState(
    asset?.youtubeStartAtSeconds === null ||
      asset?.youtubeStartAtSeconds === undefined
      ? "0"
      : String(asset.youtubeStartAtSeconds)
  );
  const [endAt, setEndAt] = useState(
    asset?.youtubeEndAtSeconds === null ||
      asset?.youtubeEndAtSeconds === undefined
      ? ""
      : String(asset.youtubeEndAtSeconds)
  );
  const [videoUploadId, setVideoUploadId] = useState(
    pendingUpload?.status === "READY" ? pendingUpload.id : ""
  );
  const [videoUploadCanSave, setVideoUploadCanSave] = useState(true);
  const handleVideoUploadStatus = useCallback(
    (next: { readonly canSave: boolean; readonly uploadId: string | null }) => {
      setVideoUploadId(next.uploadId ?? "");
      setVideoUploadCanSave(next.canSave);
    },
    []
  );

  useEffect(() => {
    if (state.status === "saved") {
      setVideoUploadId("");
      setVideoUploadCanSave(true);
    }
  }, [state.status]);

  return (
    <form
      action={formAction}
      aria-label="Editar aula"
      className="gl-lesson-form"
    >
      <input name="lessonId" type="hidden" value={lesson.id} />
      <input name="courseId" type="hidden" value={courseId} />
      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={state.expectedUpdatedAt}
      />
      <input name="assetId" type="hidden" value={state.assetId ?? ""} />
      <input
        name="videoUploadId"
        type="hidden"
        value={provider === "STORAGE" ? videoUploadId : ""}
      />
      <input
        name="assetExpectedUpdatedAt"
        type="hidden"
        value={state.assetExpectedUpdatedAt}
      />
      <input name="idempotencyKey" type="hidden" value={state.idempotencyKey} />
      <input name="mediaProvider" type="hidden" value={provider} />
      <input name="title" type="hidden" value={title} />
      <input
        defaultValue={JSON.stringify(lesson.content)}
        name="contentJson"
        ref={contentInputRef}
        type="hidden"
      />

      <section className="gl-lesson-card">
        <h2>Conteúdo da aula</h2>
        <LessonBasics lesson={lesson} onTitleChange={setTitle} title={title} />

        <ProviderSelector
          asset={asset}
          onChange={setProvider}
          value={provider}
        />

        {provider === "YOUTUBE" ? (
          <YouTubeFields
            asset={asset}
            endAt={endAt}
            lesson={lesson}
            onEndAtChange={setEndAt}
            onStartAtChange={setStartAt}
            onTitleChange={setTitle}
            startAt={startAt}
          />
        ) : (
          <GestaoLessonVideoUpload
            courseId={courseId}
            currentAsset={
              asset
                ? {
                    hasStoredAsset: asset.hasStoredAsset,
                    id: asset.id,
                    updatedAt: asset.updatedAt.toISOString(),
                  }
                : null
            }
            lessonId={lesson.id}
            maxSizeBytes={maxVideoUploadBytes}
            memberId={memberId}
            onStatusChange={handleVideoUploadStatus}
            pendingUpload={pendingUpload}
          />
        )}

        {provider === "EXTERNAL_URL" ? (
          <ExternalUrlField initialValue={asset?.externalUrl ?? ""} />
        ) : null}

        <LessonTextFields
          description={lesson.description}
          objectives={lesson.objectives}
        />
        <div className="gl-lesson-rich-label">Texto de apoio</div>
        <TopicEditor
          ariaLabel="Descrição e conteúdo da aula"
          defaultValue={lesson.content}
          onDocumentChange={(document) => {
            if (contentInputRef.current) {
              contentInputRef.current.value = JSON.stringify(document);
            }
          }}
        />
        <div className="gl-lesson-save-row">
          <SaveFeedback message={state.message} status={state.status} />
          <Button disabled={pending || !videoUploadCanSave} type="submit">
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </section>
    </form>
  );
};
