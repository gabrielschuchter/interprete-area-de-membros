"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  InstagramIcon,
  Link2Icon,
  MailIcon,
  MessageCircleIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface ShareLinkRow {
  readonly canRevoke: boolean;
  readonly createdAt: string;
  readonly createdByCurrentUser: boolean;
  readonly id: string;
  readonly revokedAt: string | null;
}

interface CommunityPostShareDialogProperties {
  readonly description: string;
  readonly postId: string;
  readonly title: string;
}

const shareEndpoint = "/api/community/post-shares";
const genericError = "Não foi possível atualizar os links. Tente novamente.";

const errorFromResponse = async (response: Response) => {
  const payload: unknown = await response.json().catch(() => null);
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return genericError;
};

const readLinks = async (postId: string) => {
  const query = new URLSearchParams({ postId });
  const response = await fetch(`${shareEndpoint}?${query.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(await errorFromResponse(response));
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("links" in payload)) {
    throw new Error(genericError);
  }
  return payload.links as ShareLinkRow[];
};

const ShareLinkItem = ({
  link,
  pendingRevokeId,
  onRevoke,
}: {
  readonly link: ShareLinkRow;
  readonly onRevoke: (id: string) => void;
  readonly pendingRevokeId: string | null;
}) => {
  let label = "Link ativo";
  if (link.revokedAt) {
    label = "Revogado";
  } else if (link.createdByCurrentUser) {
    label = "Seu link";
  }
  return (
    <li data-share-link-id={link.id}>
      <span>
        <strong>{label}</strong>
        <time dateTime={link.createdAt}>
          {new Date(link.createdAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </time>
      </span>
      {link.canRevoke && !link.revokedAt ? (
        <Button
          aria-label="Revogar link"
          className="min-h-10"
          disabled={pendingRevokeId !== null}
          onClick={() => onRevoke(link.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          {pendingRevokeId === link.id ? "Revogando…" : "Revogar"}
        </Button>
      ) : (
        <span className="community-share-links__state">
          {link.revokedAt ? "Sem acesso" : "Revogação indisponível"}
        </span>
      )}
    </li>
  );
};

const ShareLinksList = ({
  headingId,
  links,
  isListing,
  pendingRevokeId,
  onRevoke,
}: {
  readonly headingId: string;
  readonly isListing: boolean;
  readonly links: readonly ShareLinkRow[];
  readonly onRevoke: (id: string) => void;
  readonly pendingRevokeId: string | null;
}) => (
  <section aria-labelledby={headingId} className="community-share-links">
    <div className="community-share-links__heading">
      <h3 id={headingId}>Links desta publicação</h3>
      <span>
        {isListing
          ? "Atualizando…"
          : `${links.filter((link) => !link.revokedAt).length} ativos`}
      </span>
    </div>
    {links.length ? (
      <ul>
        {links.map((link) => (
          <ShareLinkItem
            key={link.id}
            link={link}
            onRevoke={onRevoke}
            pendingRevokeId={pendingRevokeId}
          />
        ))}
      </ul>
    ) : (
      <p>Nenhum link criado ainda.</p>
    )}
  </section>
);

const instagramDirectUrl = "https://www.instagram.com/direct/inbox/";
const instagramStoryUrl = "instagram://story-camera";
const instagramWebUrl = "https://www.instagram.com/";

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;

const copyText = (value: string) =>
  navigator.clipboard
    .writeText(value)
    .then(() => true)
    .catch(() => false);

/**
 * Abre o destino numa aba criada ainda no clique: o link pode precisar ser
 * gerado antes, e uma aba aberta depois de um await é barrada como pop-up.
 */
const openAfter = async (resolveUrl: () => Promise<string | null>) => {
  const opened = window.open("", "_blank");
  const url = await resolveUrl();
  if (!url) {
    opened?.close();
    return;
  }
  if (opened) {
    opened.opener = null;
    opened.location.href = url;
  } else {
    window.location.href = url;
  }
};

const ShareDestinations = ({
  ensureLink,
  onStatus,
  storyFile,
  title,
}: {
  readonly ensureLink: () => Promise<string | null>;
  readonly onStatus: (message: string) => void;
  readonly storyFile: File | null;
  readonly title: string;
}) => {
  // O Instagram não recebe link pronto vindo do navegador. Nos stories, a
  // imagem do cartão vai pela folha de compartilhamento do aparelho; sem ela,
  // o link é copiado para a figurinha de link. No direct, o link é copiado e
  // a caixa de mensagens abre.
  const shareStory = async () => {
    if (storyFile && navigator.canShare?.({ files: [storyFile] })) {
      try {
        await navigator.share({ files: [storyFile], title });
        onStatus(
          "Escolha o Instagram e depois Stories. Use a figurinha de link com o endereço copiado."
        );
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
      }
    }
    const resolveStory = async () => {
      const link = await ensureLink();
      if (!link) {
        return null;
      }
      const copied = await copyText(link);
      onStatus(
        copied
          ? "Link copiado. No story, use a figurinha de link e cole o endereço."
          : "Copie o endereço acima e use a figurinha de link no story."
      );
      return isTouchDevice() ? instagramStoryUrl : instagramWebUrl;
    };
    if (isTouchDevice()) {
      const url = await resolveStory();
      if (url) {
        window.location.href = url;
      }
      return;
    }
    await openAfter(resolveStory);
  };

  const shareDirect = () =>
    openAfter(async () => {
      const link = await ensureLink();
      if (!link) {
        return null;
      }
      const copied = await copyText(link);
      onStatus(
        copied
          ? "Link copiado. Escolha a conversa no Instagram e cole."
          : "Copie o endereço acima e cole na conversa do Instagram."
      );
      return instagramDirectUrl;
    });

  const shareWhatsapp = () =>
    openAfter(async () => {
      const link = await ensureLink();
      return link
        ? `https://wa.me/?text=${encodeURIComponent(`Olha esta publicação na Comunidade do Interprete: ${link}`)}`
        : null;
    });

  return (
    <section
      aria-label="Compartilhar nas redes"
      className="community-share-destinations"
    >
      <button onClick={shareStory} type="button">
        <InstagramIcon aria-hidden="true" className="size-4" />
        Stories
      </button>
      <button onClick={shareDirect} type="button">
        <SendIcon aria-hidden="true" className="size-4" />
        Direct
      </button>
      <button onClick={shareWhatsapp} type="button">
        <MessageCircleIcon aria-hidden="true" className="size-4" />
        WhatsApp
        <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      </button>
      <span
        aria-disabled="true"
        className="community-share-destination-disabled"
        title="Nenhum provedor de e-mail está configurado; nenhuma mensagem será enviada."
      >
        <MailIcon aria-hidden="true" className="size-4" />
        E-mail indisponível
      </span>
    </section>
  );
};

export function CommunityPostShareDialog({
  postId,
  title,
  description,
}: CommunityPostShareDialogProperties) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [currentShareId, setCurrentShareId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isListing, setIsListing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const createInFlightRef = useRef(false);
  const titleId = useId();
  const [storyFile, setStoryFile] = useState<File | null>(null);

  // No celular, a imagem do cartão fica pronta antes do toque em Stories:
  // a folha de compartilhamento só abre dentro do gesto do usuário.
  useEffect(() => {
    setStoryFile(null);
    if (
      !(shareUrl && isTouchDevice() && typeof navigator.canShare === "function")
    ) {
      return;
    }
    let cancelled = false;
    fetch(`${shareUrl}/opengraph-image`, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (blob && !cancelled) {
          setStoryFile(
            new File([blob], "interprete-publicacao.png", {
              type: blob.type || "image/png",
            })
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setIsListing(true);
    setError("");
    readLinks(postId)
      .then((nextLinks) => {
        if (!cancelled) {
          setLinks((current) => {
            const latest = new Map(current.map((link) => [link.id, link]));
            for (const link of nextLinks) {
              latest.set(link.id, link);
            }
            return [...latest.values()].sort((left, right) =>
              right.createdAt.localeCompare(left.createdAt)
            );
          });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : genericError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsListing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  const requestLink = async (): Promise<string | null> => {
    if (createInFlightRef.current) {
      return null;
    }
    createInFlightRef.current = true;
    setIsCreating(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(shareEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId }),
      });
      if (!response.ok) {
        throw new Error(await errorFromResponse(response));
      }
      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== "object" ||
        !("url" in payload) ||
        typeof payload.url !== "string" ||
        !("id" in payload) ||
        typeof payload.id !== "string" ||
        !("createdAt" in payload) ||
        typeof payload.createdAt !== "string"
      ) {
        throw new Error(genericError);
      }
      setShareUrl(payload.url);
      setCurrentShareId(payload.id);
      setLinks((current) => [
        {
          id: payload.id as string,
          createdAt: payload.createdAt as string,
          revokedAt: null,
          createdByCurrentUser: true,
          canRevoke: true,
        },
        ...current.filter((link) => link.id !== payload.id),
      ]);
      return payload.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : genericError);
      return null;
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
    }
  };

  const ensureLink = async () => shareUrl || (await requestLink());

  const createLink = async () => {
    const url = await requestLink();
    if (!url) {
      return;
    }
    if (await copyText(url)) {
      setStatus("Link copiado.");
    } else {
      setStatus("Link criado. Copie o endereço abaixo para compartilhar.");
      window.setTimeout(() => linkInputRef.current?.select(), 0);
    }
  };

  const copyExistingLink = async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("Link copiado.");
      setError("");
    } catch {
      setStatus("Selecione e copie o endereço exibido.");
      linkInputRef.current?.select();
    }
  };

  const revokeLink = async (id: string) => {
    setPendingRevokeId(id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(
        `${shareEndpoint}/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        }
      );
      if (!response.ok) {
        throw new Error(await errorFromResponse(response));
      }
      const revokedAt = new Date().toISOString();
      setLinks((current) =>
        current.map((link) => (link.id === id ? { ...link, revokedAt } : link))
      );
      if (currentShareId === id) {
        setShareUrl("");
        setCurrentShareId("");
      }
      setStatus("Link revogado. Ele não abre mais esta publicação.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : genericError);
    } finally {
      setPendingRevokeId(null);
    }
  };

  let shareButtonLabel = "Gerar link e copiar";
  if (isCreating) {
    shareButtonLabel = "Gerando link…";
  } else if (shareUrl) {
    shareButtonLabel = "Copiar link";
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="min-h-11 gap-1.5 text-sm"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Link2Icon aria-hidden="true" className="size-4" />
        <span>Compartilhar</span>
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="community-share-dialog"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        {open ? (
          <section className="community-share-dialog__content">
            <header className="community-share-dialog__header">
              <div>
                <p className="community-share-dialog__eyebrow">
                  COMUNIDADE · PUBLICAÇÃO
                </p>
                <h2 className="community-share-dialog__title" id={titleId}>
                  Compartilhar publicação
                </h2>
              </div>
              <Button
                aria-label="Fechar compartilhamento"
                onClick={() => setOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </header>

            <div className="community-share-dialog__layout">
              <aside
                aria-label="Prévia do cartão de compartilhamento"
                className="community-share-preview-column"
              >
                <div className="community-share-preview">
                  <div
                    aria-hidden="true"
                    className="community-share-preview__art"
                  >
                    <span className="community-share-preview__art-brand">
                      Interprete.
                    </span>
                    <span className="community-share-preview__art-quote">
                      “
                    </span>
                    <span className="community-share-preview__art-lines">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="community-share-preview__art-label">
                      PUBLICAÇÃO
                    </span>
                  </div>
                  <div className="community-share-preview__details">
                    <span className="community-share-preview__brand">
                      interprete.app
                    </span>
                    <strong>{title}</strong>
                    {description ? <span>{description}</span> : null}
                    <span className="community-share-preview__cta">
                      Entre na discussão no Interprete
                    </span>
                  </div>
                </div>
              </aside>

              <div className="community-share-dialog__controls">
                <p className="community-share-dialog__privacy">
                  Compartilhar o link não altera o acesso. Quem não tiver
                  permissão verá apenas uma página genérica.
                </p>

                <div
                  className={`community-share-link-row ${shareUrl ? "community-share-link-row--active" : "community-share-link-row--empty"}`}
                >
                  {shareUrl ? (
                    <input
                      aria-label="Link de compartilhamento"
                      className="community-share-link-input"
                      onFocus={(event) => event.currentTarget.select()}
                      readOnly
                      ref={linkInputRef}
                      value={shareUrl}
                    />
                  ) : null}
                  <Button
                    className="min-h-11"
                    disabled={isCreating}
                    onClick={shareUrl ? copyExistingLink : createLink}
                    type="button"
                  >
                    {shareUrl ? (
                      <CopyIcon aria-hidden="true" className="size-4" />
                    ) : (
                      <Link2Icon aria-hidden="true" className="size-4" />
                    )}
                    {shareButtonLabel}
                  </Button>
                </div>

                <ShareDestinations
                  ensureLink={ensureLink}
                  onStatus={(message) => {
                    setError("");
                    setStatus(message);
                  }}
                  storyFile={storyFile}
                  title={title}
                />

                {status ? (
                  <output
                    aria-live="polite"
                    className="community-share-dialog__status"
                  >
                    <CheckIcon aria-hidden="true" className="size-4" />
                    {status}
                  </output>
                ) : null}
                {error ? (
                  <p className="community-share-dialog__error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>

            <ShareLinksList
              headingId={`${titleId}-links`}
              isListing={isListing}
              links={links}
              onRevoke={revokeLink}
              pendingRevokeId={pendingRevokeId}
            />
          </section>
        ) : null}
      </dialog>
    </>
  );
}
