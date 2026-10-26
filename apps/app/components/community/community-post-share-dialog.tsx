"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  Link2Icon,
  MailIcon,
  MessageCircleIcon,
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

const ShareDestinations = ({ shareUrl }: { readonly shareUrl: string }) => {
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Olha esta publicação na Comunidade do Interprete: ${shareUrl}`)}`;
  return (
    <section
      aria-label="Outras formas de compartilhar"
      className="community-share-destinations"
    >
      <a href={whatsappHref} rel="noopener noreferrer" target="_blank">
        <MessageCircleIcon aria-hidden="true" className="size-4" />
        WhatsApp
        <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      </a>
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

  const createLink = async () => {
    if (createInFlightRef.current) {
      return;
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
      try {
        await navigator.clipboard.writeText(payload.url);
        setStatus("Link copiado.");
      } catch {
        setStatus("Link criado. Copie o endereço abaixo para compartilhar.");
        window.setTimeout(() => linkInputRef.current?.select(), 0);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : genericError);
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
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

                {shareUrl ? <ShareDestinations shareUrl={shareUrl} /> : null}

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
