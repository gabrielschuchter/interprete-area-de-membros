"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArchiveIcon,
  EllipsisIcon,
  PinIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  setPostStatus,
  softDeletePost,
  togglePostFeatured,
  togglePostPin,
} from "@/app/(authenticated)/comunidade/actions";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "../mutations/single-flight-form";

interface CommunityPostMenuProperties {
  readonly canModerate: boolean;
  readonly isFeatured: boolean;
  readonly isPinned: boolean;
  readonly postId: string;
  readonly returnTo?: string;
  readonly spaceSlug: string;
  readonly status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export function CommunityPostMenu({
  canModerate,
  isFeatured,
  isPinned,
  postId,
  returnTo,
  status = "PUBLISHED",
  spaceSlug,
}: CommunityPostMenuProperties) {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstItem =
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (!(event.key === "ArrowDown" || event.key === "ArrowUp")) {
        return;
      }
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
          []
      );
      if (items.length === 0) {
        return;
      }
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      items[(index + direction + items.length) % items.length]?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  return (
    <div className="community-post-menu" ref={menuRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Ações da publicação"
        className="community-post-menu__trigger"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        size="icon"
        type="button"
        variant="outline"
      >
        <EllipsisIcon aria-hidden="true" />
      </Button>
      {open && (
        <div
          aria-label="Ações da publicação"
          className="community-post-menu__popover"
          role="menu"
        >
          <Link
            className="community-post-menu__item"
            href={
              returnTo
                ? `/comunidade/editor/${postId}?from=${encodeURIComponent(returnTo)}`
                : `/comunidade/editor/${postId}`
            }
            onClick={() => close()}
            role="menuitem"
            tabIndex={0}
          >
            Editar
          </Link>
          {canModerate && status === "PUBLISHED" && (
            <>
              <SingleFlightForm
                action={togglePostPin}
                className="community-post-menu__form"
                onSettled={() => close()}
              >
                <input name="postId" type="hidden" value={postId} />
                <input name="spaceSlug" type="hidden" value={spaceSlug} />
                <input
                  name="desired"
                  type="hidden"
                  value={isPinned ? "off" : "on"}
                />
                <SingleFlightSubmit
                  className="community-post-menu__item"
                  pendingLabel="Salvando…"
                  role="menuitem"
                  variant="ghost"
                >
                  <PinIcon aria-hidden="true" />
                  {isPinned ? "Desafixar" : "Fixar"}
                </SingleFlightSubmit>
              </SingleFlightForm>
              <SingleFlightForm
                action={togglePostFeatured}
                className="community-post-menu__form"
                onSettled={() => close()}
              >
                <input name="postId" type="hidden" value={postId} />
                <input name="spaceSlug" type="hidden" value={spaceSlug} />
                <input
                  name="desired"
                  type="hidden"
                  value={isFeatured ? "off" : "on"}
                />
                <SingleFlightSubmit
                  className="community-post-menu__item"
                  pendingLabel="Salvando…"
                  role="menuitem"
                  variant="ghost"
                >
                  <StarIcon aria-hidden="true" />
                  {isFeatured ? "Retirar destaque" : "Destacar"}
                </SingleFlightSubmit>
              </SingleFlightForm>
            </>
          )}
          {status === "PUBLISHED" ? (
            <>
              <SingleFlightForm
                action={setPostStatus}
                className="community-post-menu__form"
                onSettled={() => close()}
              >
                <input name="postId" type="hidden" value={postId} />
                <input name="spaceSlug" type="hidden" value={spaceSlug} />
                <input name="status" type="hidden" value="ARCHIVED" />
                <SingleFlightSubmit
                  className="community-post-menu__item"
                  pendingLabel="Salvando…"
                  role="menuitem"
                  variant="ghost"
                >
                  <ArchiveIcon aria-hidden="true" /> Arquivar
                </SingleFlightSubmit>
              </SingleFlightForm>
              <div
                aria-hidden="true"
                className="community-post-menu__separator"
              />
            </>
          ) : null}
          {status === "ARCHIVED" ? (
            <SingleFlightForm
              action={setPostStatus}
              className="community-post-menu__form"
              onSettled={() => close()}
            >
              <input name="postId" type="hidden" value={postId} />
              <input name="spaceSlug" type="hidden" value={spaceSlug} />
              <input name="status" type="hidden" value="PUBLISHED" />
              <SingleFlightSubmit
                className="community-post-menu__item"
                pendingLabel="Restaurando…"
                role="menuitem"
                variant="ghost"
              >
                <ArchiveIcon aria-hidden="true" /> Restaurar publicação
              </SingleFlightSubmit>
            </SingleFlightForm>
          ) : null}
          <Button
            className="community-post-menu__item community-post-menu__item--danger"
            onClick={() => {
              setOpen(false);
              setDeleteDialogOpen(true);
            }}
            role="menuitem"
            type="button"
            variant="ghost"
          >
            <Trash2Icon aria-hidden="true" /> Excluir
          </Button>
        </div>
      )}
      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {status === "DRAFT" ? "rascunho" : "publicação"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {returnTo?.startsWith("/comunidade/minhas-publicacoes")
                ? "Você poderá desfazer em até 8 segundos. Depois, a equipe ainda poderá recuperar o conteúdo por até 30 dias."
                : "A equipe ainda poderá recuperar o conteúdo por até 30 dias."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <SingleFlightForm
              action={softDeletePost}
              className="community-post-menu__form"
              onSettled={() => setDeleteDialogOpen(false)}
            >
              <input name="postId" type="hidden" value={postId} />
              <input
                name="returnTo"
                type="hidden"
                value={returnTo ?? "/comunidade"}
              />
              <input name="spaceSlug" type="hidden" value={spaceSlug} />
              <SingleFlightSubmit
                className="community-post-menu__confirm-delete"
                pendingLabel="Excluindo…"
                variant="destructive"
              >
                Excluir
              </SingleFlightSubmit>
            </SingleFlightForm>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
