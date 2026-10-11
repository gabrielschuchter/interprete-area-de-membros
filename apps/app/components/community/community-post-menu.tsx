"use client";

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
  readonly spaceSlug: string;
  readonly status?: "DRAFT" | "PUBLISHED";
}

export function CommunityPostMenu({
  canModerate,
  isFeatured,
  isPinned,
  postId,
  status = "PUBLISHED",
  spaceSlug,
}: CommunityPostMenuProperties) {
  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setDeleteConfirm(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstItem = menuRef.current?.querySelector<HTMLElement>(
      deleteConfirm ? ".community-post-menu__cancel" : '[role="menuitem"]'
    );
    firstItem?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDeleteConfirm(false);
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
  }, [close, deleteConfirm, open]);

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
          aria-label={
            deleteConfirm
              ? "Confirmar exclusão da publicação"
              : "Ações da publicação"
          }
          className={[
            "community-post-menu__popover",
            deleteConfirm && "is-confirming-delete",
          ]
            .filter(Boolean)
            .join(" ")}
          role="menu"
        >
          {deleteConfirm ? (
            <>
              <p className="community-post-menu__confirmation-title">
                Excluir publicação?
              </p>
              <p className="community-post-menu__confirmation-copy">
                Essa ação não pode ser desfeita.
              </p>
              <div className="community-post-menu__confirmation-actions">
                <Button
                  className="community-post-menu__cancel"
                  onClick={() => setDeleteConfirm(false)}
                  role="menuitem"
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <SingleFlightForm
                  action={softDeletePost}
                  className="community-post-menu__form"
                  onSettled={() => close()}
                >
                  <input name="postId" type="hidden" value={postId} />
                  <input name="spaceSlug" type="hidden" value={spaceSlug} />
                  <SingleFlightSubmit
                    className="community-post-menu__confirm-delete"
                    pendingLabel="Excluindo…"
                    role="menuitem"
                    variant="default"
                  >
                    Excluir
                  </SingleFlightSubmit>
                </SingleFlightForm>
              </div>
            </>
          ) : (
            <>
              <Link
                className="community-post-menu__item"
                href={`/comunidade/editor/${postId}`}
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
              <Button
                className="community-post-menu__item community-post-menu__item--danger"
                onClick={() => setDeleteConfirm(true)}
                role="menuitem"
                type="button"
                variant="ghost"
              >
                <Trash2Icon aria-hidden="true" /> Excluir
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
