"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { AlertCircleIcon, CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  importGestaoYouTubePlaylist,
  previewGestaoYouTubePlaylist,
} from "@/app/(authenticated)/gestao/ensino/cursos/actions";
import type { YouTubePlaylistItem } from "@/lib/youtube-verification";

const MAX_PLAYLIST_IMPORT_ITEMS = 200;

interface PlaylistImportModule {
  readonly id: string;
  readonly status: string;
  readonly title: string;
}

interface PlaylistImportItem extends YouTubePlaylistItem {
  readonly selectionToken: string | null;
}

interface YouTubePlaylistImportDialogProperties {
  readonly courseId: string;
  readonly courseStatus: string;
  readonly initialIdempotencyKey: string;
  readonly modules: readonly PlaylistImportModule[];
  readonly open: boolean;
}

const formatDuration = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const privacyLabel = (item: PlaylistImportItem) => {
  if (!item.metadata) {
    return "Privado ou não encontrado";
  }
  if (item.metadata.privacyStatus === "PUBLIC") {
    return "Público";
  }
  if (item.metadata.privacyStatus === "UNLISTED") {
    return "Não listado";
  }
  return "Privado ou não encontrado";
};

const errorLabel = (code: string) => {
  if (code === "NOT_CONFIGURED") {
    return "A importação depende da chave da API do YouTube, configurada pelo administrador.";
  }
  if (code === "UNAVAILABLE") {
    return "O YouTube não respondeu com os dados necessários. Tente novamente em instantes.";
  }
  if (code === "NOT_FOUND") {
    return "O módulo escolhido não está mais disponível. Atualize a página.";
  }
  if (code === "CONFLICT") {
    return "O conteúdo mudou durante a importação. Atualize a página e tente novamente.";
  }
  return "Confira os dados e tente novamente.";
};

const toggleAllLabel = (
  allLoadedSelected: boolean,
  selectionLimitReached: boolean
) => {
  if (allLoadedSelected) {
    return "Desmarcar disponíveis";
  }
  return selectionLimitReached
    ? "Limite de 200 por lote"
    : "Selecionar disponíveis";
};

const PlaylistVideoRows = ({
  items,
  isPending,
  onToggle,
  selectedTokens,
  selectionLimitReached,
  success,
}: {
  readonly items: readonly PlaylistImportItem[];
  readonly isPending: boolean;
  readonly onToggle: (token: string, checked: boolean) => void;
  readonly selectedTokens: ReadonlySet<string>;
  readonly selectionLimitReached: boolean;
  readonly success: string;
}) => (
  <ul className="gl-playlist-video-list">
    {items.map((item) => (
      <li
        className={item.selectionToken ? "" : "is-unavailable"}
        key={`${item.position}-${item.videoId}`}
      >
        <label className="gl-playlist-video-row">
          <input
            checked={
              item.selectionToken
                ? selectedTokens.has(item.selectionToken)
                : false
            }
            disabled={
              !item.selectionToken ||
              isPending ||
              Boolean(success) ||
              (Boolean(item.selectionToken) &&
                !selectedTokens.has(item.selectionToken as string) &&
                selectionLimitReached)
            }
            onChange={(event) => {
              if (item.selectionToken) {
                onToggle(item.selectionToken, event.target.checked);
              }
            }}
            type="checkbox"
          />
          {item.thumbnailUrl ? (
            // YouTube thumbnails are validated against i.ytimg.com by the server adapter.
            // biome-ignore lint/performance/noImgElement: Remote YouTube thumbnails are not part of the local image pipeline.
            <img alt="" height={52} src={item.thumbnailUrl} width={92} />
          ) : (
            <span
              aria-hidden="true"
              className="gl-playlist-thumbnail-placeholder"
            >
              YT
            </span>
          )}
          <span className="gl-playlist-video-copy">
            <span className="gl-playlist-video-title">{item.title}</span>
            <span className="gl-playlist-video-meta">
              <span>
                {formatDuration(item.metadata?.durationSeconds ?? null)}
              </span>
              <span
                className={`gl-playlist-privacy is-${item.metadata?.privacyStatus?.toLowerCase() ?? "unknown"}`}
              >
                {privacyLabel(item)}
              </span>
              {item.metadata?.embeddable === false ? (
                <span className="gl-playlist-privacy is-warning">
                  Incorporação desativada
                </span>
              ) : null}
            </span>
          </span>
        </label>
      </li>
    ))}
  </ul>
);

const PlaylistResults = ({
  allLoadedSelected,
  isPending,
  items,
  nextPageToken,
  onLoadPage,
  onToggle,
  onToggleAll,
  selectedTokens,
  selectionLimitReached,
  success,
  totalResults,
}: {
  readonly allLoadedSelected: boolean;
  readonly isPending: boolean;
  readonly items: readonly PlaylistImportItem[];
  readonly nextPageToken: string | null;
  readonly onLoadPage: (pageToken?: string | null) => void;
  readonly onToggle: (token: string, checked: boolean) => void;
  readonly onToggleAll: () => void;
  readonly selectedTokens: ReadonlySet<string>;
  readonly selectionLimitReached: boolean;
  readonly success: string;
  readonly totalResults: number;
}) => (
  <section aria-label="Vídeos da lista" className="gl-playlist-results">
    <div className="gl-playlist-results-heading">
      <div>
        <h3>Vídeos encontrados</h3>
        <p>
          {items.length} de {totalResults} carregados · selecione os que deseja
          adicionar
        </p>
      </div>
      <Button
        disabled={
          isPending ||
          Boolean(success) ||
          (selectionLimitReached && !allLoadedSelected)
        }
        onClick={onToggleAll}
        size="sm"
        type="button"
        variant="ghost"
      >
        {toggleAllLabel(allLoadedSelected, selectionLimitReached)}
      </Button>
    </div>
    <PlaylistVideoRows
      isPending={isPending}
      items={items}
      onToggle={onToggle}
      selectedTokens={selectedTokens}
      selectionLimitReached={selectionLimitReached}
      success={success}
    />
    {nextPageToken ? (
      <Button
        className="gl-playlist-load-more"
        disabled={isPending || Boolean(success)}
        onClick={() => onLoadPage(nextPageToken)}
        size="sm"
        type="button"
        variant="ghost"
      >
        {isPending ? "Carregando…" : "Carregar mais vídeos"}
      </Button>
    ) : null}
  </section>
);

const PlaylistImportOptions = ({
  canPublish,
  moduleId,
  modules,
  onModuleChange,
  onStatusChange,
  onUseTitleChange,
  status,
  useVideoTitle,
}: {
  readonly canPublish: boolean;
  readonly moduleId: string;
  readonly modules: readonly PlaylistImportModule[];
  readonly onModuleChange: (moduleId: string) => void;
  readonly onStatusChange: (status: "DRAFT" | "PUBLISHED") => void;
  readonly onUseTitleChange: (value: boolean) => void;
  readonly status: "DRAFT" | "PUBLISHED";
  readonly useVideoTitle: boolean;
}) => (
  <div className="gl-playlist-import-options">
    <label htmlFor="gl-youtube-import-module">
      <span>Criar em</span>
      <select
        id="gl-youtube-import-module"
        onChange={(event) => onModuleChange(event.target.value)}
        value={moduleId}
      >
        {modules.map((module) => (
          <option key={module.id} value={module.id}>
            {module.title}
          </option>
        ))}
      </select>
    </label>
    <label htmlFor="gl-youtube-import-status">
      <span>Estado das aulas</span>
      <select
        id="gl-youtube-import-status"
        onChange={(event) =>
          onStatusChange(event.target.value as "DRAFT" | "PUBLISHED")
        }
        value={status}
      >
        <option value="DRAFT">Rascunho</option>
        <option disabled={!canPublish} value="PUBLISHED">
          Publicadas
          {canPublish ? "" : " · publique curso e módulo antes"}
        </option>
      </select>
    </label>
    <label className="gl-playlist-title-toggle" htmlFor="gl-youtube-use-title">
      <input
        checked={useVideoTitle}
        id="gl-youtube-use-title"
        onChange={(event) => onUseTitleChange(event.target.checked)}
        type="checkbox"
      />
      Usar o título do vídeo como título da aula
    </label>
  </div>
);

const playlistNotice = (
  items: readonly PlaylistImportItem[],
  publicCount: number,
  unavailableCount: number,
  status: "DRAFT" | "PUBLISHED",
  selected: readonly PlaylistImportItem[]
) => {
  const messages: string[] = [];
  if (unavailableCount > 0) {
    messages.push(
      `${unavailableCount} vídeo${unavailableCount === 1 ? " não pode" : "s não podem"} ser importado${unavailableCount === 1 ? "" : "s"}.`
    );
  }
  if (selected.length >= MAX_PLAYLIST_IMPORT_ITEMS) {
    messages.push(
      `Limite de ${MAX_PLAYLIST_IMPORT_ITEMS} aulas por lote. Desmarque uma aula para selecionar outra.`
    );
  }
  if (publicCount > 0) {
    messages.push(
      `${publicCount} vídeo${publicCount === 1 ? " público será" : "s públicos serão"} importado${publicCount === 1 ? "" : "s"} com um aviso de visibilidade.`
    );
  }
  if (
    status === "PUBLISHED" &&
    selected.some((item) => item.metadata?.embeddable !== true)
  ) {
    messages.push(
      "A publicação fica bloqueada enquanto a incorporação estiver desativada."
    );
  }
  return items.length > 0 ? messages.join(" ") : "";
};

const PlaylistImportNotices = ({
  error,
  items,
  publicCount,
  selected,
  status,
  success,
  unavailableCount,
}: {
  readonly error: string;
  readonly items: readonly PlaylistImportItem[];
  readonly publicCount: number;
  readonly selected: readonly PlaylistImportItem[];
  readonly status: "DRAFT" | "PUBLISHED";
  readonly success: string;
  readonly unavailableCount: number;
}) => {
  const warning = playlistNotice(
    items,
    publicCount,
    unavailableCount,
    status,
    selected
  );
  return (
    <>
      {warning ? (
        <output aria-live="polite" className="gl-playlist-warning">
          <AlertCircleIcon aria-hidden="true" /> <span>{warning}</span>
        </output>
      ) : null}
      {error ? (
        <p className="gl-playlist-error" role="alert">
          <AlertCircleIcon aria-hidden="true" /> {error}
        </p>
      ) : null}
      {success ? (
        <output aria-live="polite" className="gl-playlist-success">
          <CheckIcon aria-hidden="true" /> {success}
        </output>
      ) : null}
    </>
  );
};

export const YouTubePlaylistImportDialog = ({
  courseId,
  courseStatus,
  initialIdempotencyKey,
  modules,
  open,
}: YouTubePlaylistImportDialogProperties) => {
  const router = useRouter();
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [useVideoTitle, setUseVideoTitle] = useState(true);
  const [items, setItems] = useState<PlaylistImportItem[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(
    () => new Set()
  );
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(initialIdempotencyKey);
  const [isPending, startTransition] = useTransition();

  const currentModule = modules.find((item) => item.id === moduleId);
  const canPublish =
    courseStatus === "PUBLISHED" && currentModule?.status === "PUBLISHED";
  const orderedSelection = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.selectionToken && selectedTokens.has(item.selectionToken)
        )
        .sort((left, right) => left.position - right.position),
    [items, selectedTokens]
  );
  const selectedPublicCount = orderedSelection.filter(
    (item) => item.metadata?.privacyStatus === "PUBLIC"
  ).length;
  const unavailableCount = items.filter(
    (item) => item.selectionToken === null
  ).length;
  const allLoadedSelected =
    items.filter((item) => item.selectionToken).length > 0 &&
    items
      .filter((item) => item.selectionToken)
      .every((item) => selectedTokens.has(item.selectionToken as string));
  const previewIsCurrent = loadedUrl !== "" && loadedUrl === playlistUrl.trim();

  const loadPage = (pageToken?: string | null) => {
    if (!(moduleId && playlistUrl.trim())) {
      setError("Informe o link da lista e escolha um módulo.");
      return;
    }
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await previewGestaoYouTubePlaylist({
        courseId,
        moduleId,
        pageToken,
        playlistUrl: playlistUrl.trim(),
      });
      if (!result.ok) {
        setError(`${errorLabel(result.error.code)} ${result.error.message}`);
        return;
      }
      const newItems = result.data.items;
      const importableCount = newItems.filter(
        (item) => item.selectionToken !== null
      ).length;
      if (
        importableCount >
        Math.max(0, MAX_PLAYLIST_IMPORT_ITEMS - selectedTokens.size)
      ) {
        setError(
          `O lote comporta até ${MAX_PLAYLIST_IMPORT_ITEMS} aulas. Desmarque aulas anteriores para selecionar mais vídeos.`
        );
      }
      setItems((current) => (pageToken ? [...current, ...newItems] : newItems));
      setNextPageToken(result.data.nextPageToken);
      setTotalResults(result.data.totalResults);
      setLoadedUrl(playlistUrl.trim());
      setSelectedTokens((current) => {
        const next = pageToken ? new Set(current) : new Set<string>();
        for (const item of newItems) {
          if (
            item.selectionToken &&
            (next.has(item.selectionToken) ||
              next.size < MAX_PLAYLIST_IMPORT_ITEMS)
          ) {
            next.add(item.selectionToken);
          }
        }
        return next;
      });
    });
  };

  const toggleAll = () => {
    const importableItems = items.filter(
      (item): item is PlaylistImportItem & { selectionToken: string } =>
        item.selectionToken !== null
    );
    const newSelections = importableItems.filter(
      (item) => !selectedTokens.has(item.selectionToken)
    ).length;
    if (
      !allLoadedSelected &&
      newSelections >
        Math.max(0, MAX_PLAYLIST_IMPORT_ITEMS - selectedTokens.size)
    ) {
      setError(
        `O lote comporta até ${MAX_PLAYLIST_IMPORT_ITEMS} aulas. Desmarque aulas anteriores para selecionar mais vídeos.`
      );
    } else {
      setError("");
    }
    setSelectedTokens((current) => {
      const next = new Set(current);
      for (const item of importableItems) {
        if (allLoadedSelected) {
          next.delete(item.selectionToken);
        } else if (
          next.has(item.selectionToken) ||
          next.size < MAX_PLAYLIST_IMPORT_ITEMS
        ) {
          next.add(item.selectionToken);
        }
      }
      return next;
    });
  };

  const importSelected = () => {
    if (!previewIsCurrent || orderedSelection.length === 0 || !moduleId) {
      return;
    }
    if (status === "PUBLISHED" && !canPublish) {
      setError("Publique o curso e o módulo antes de criar aulas publicadas.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await importGestaoYouTubePlaylist({
        courseId,
        idempotencyKey,
        moduleId,
        selectionTokens: orderedSelection.flatMap((item) =>
          item.selectionToken ? [item.selectionToken] : []
        ),
        status,
        useVideoTitle,
      });
      if (!result.ok) {
        setError(`${errorLabel(result.error.code)} ${result.error.message}`);
        return;
      }
      const { importedCount, publicCount } = result.data;
      const noun = importedCount === 1 ? "aula criada" : "aulas criadas";
      const publicNote =
        publicCount > 0
          ? ` ${publicCount} vídeo${publicCount === 1 ? " público foi" : "s públicos foram"} importado${publicCount === 1 ? "" : "s"} com aviso de visibilidade.`
          : "";
      setSuccess(
        `${importedCount} ${noun} em ${currentModule?.title ?? "módulo"}.${publicNote}`
      );
      setIdempotencyKey(crypto.randomUUID());
      setSelectedTokens(new Set());
      router.refresh();
    });
  };

  useEffect(() => {
    if (!open) {
      setError("");
      setSuccess("");
    }
  }, [open]);

  if (modules.length === 0) {
    return null;
  }

  return (
    <DialogContent className="gl-playlist-dialog max-h-[92dvh] max-w-[760px] gap-0 overflow-hidden border-[#DED2CF] bg-[#FBF8F5] p-0 sm:max-w-[760px]">
      <DialogHeader className="gl-playlist-dialog-header">
        <p className="gestao-eyebrow">YouTube · aulas</p>
        <DialogTitle className="gl-playlist-dialog-title">
          Importar de uma lista de reprodução
        </DialogTitle>
        <DialogDescription className="gl-playlist-dialog-description">
          Cria uma aula para cada vídeo selecionado, mantendo a ordem da lista.
        </DialogDescription>
      </DialogHeader>

      <div className="gl-playlist-dialog-body">
        <div className="gl-playlist-url-row">
          <label htmlFor="gl-youtube-playlist-url">
            Link da lista do YouTube
          </label>
          <div>
            <Input
              autoComplete="url"
              id="gl-youtube-playlist-url"
              maxLength={2048}
              onChange={(event) => setPlaylistUrl(event.target.value)}
              placeholder="https://www.youtube.com/playlist?list=…"
              type="url"
              value={playlistUrl}
            />
            <Button
              disabled={isPending || playlistUrl.trim().length === 0}
              onClick={() => loadPage()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isPending && items.length === 0
                ? "Carregando…"
                : "Carregar lista"}
            </Button>
          </div>
        </div>

        {previewIsCurrent && items.length > 0 ? (
          <PlaylistResults
            allLoadedSelected={allLoadedSelected}
            isPending={isPending}
            items={items}
            nextPageToken={nextPageToken}
            onLoadPage={loadPage}
            onToggle={(token, checked) => {
              setError("");
              setSelectedTokens((current) => {
                const next = new Set(current);
                if (checked) {
                  if (next.size >= MAX_PLAYLIST_IMPORT_ITEMS) {
                    return next;
                  }
                  next.add(token);
                } else {
                  next.delete(token);
                }
                return next;
              });
            }}
            onToggleAll={toggleAll}
            selectedTokens={selectedTokens}
            selectionLimitReached={
              selectedTokens.size >= MAX_PLAYLIST_IMPORT_ITEMS
            }
            success={success}
            totalResults={totalResults}
          />
        ) : null}

        <PlaylistImportOptions
          canPublish={canPublish}
          moduleId={moduleId}
          modules={modules}
          onModuleChange={setModuleId}
          onStatusChange={setStatus}
          onUseTitleChange={setUseVideoTitle}
          status={status}
          useVideoTitle={useVideoTitle}
        />

        <PlaylistImportNotices
          error={error}
          items={items}
          publicCount={selectedPublicCount}
          selected={orderedSelection}
          status={status}
          success={success}
          unavailableCount={unavailableCount}
        />
      </div>

      <DialogFooter className="gl-playlist-dialog-footer">
        <DialogClose asChild>
          <Button disabled={isPending} type="button" variant="outline">
            {success ? "Fechar" : "Cancelar"}
          </Button>
        </DialogClose>
        <Button
          disabled={
            isPending ||
            Boolean(success) ||
            !previewIsCurrent ||
            orderedSelection.length === 0 ||
            (status === "PUBLISHED" && !canPublish)
          }
          onClick={importSelected}
          type="button"
        >
          {isPending
            ? "Importando…"
            : `Importar ${orderedSelection.length} aula${orderedSelection.length === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
