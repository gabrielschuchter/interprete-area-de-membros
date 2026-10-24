"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { GestaoIcon } from "./gestao-icon";

// The dialog (results, recents, server action) loads on first use so the
// shell keeps a small initial bundle on every Gestão route.
const GestaoSearchDialog = dynamic(() => import("./gestao-search-dialog"), {
  ssr: false,
});

export const GestaoSearch = ({ memberId }: { readonly memberId: string }) => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const show = () => {
    setLoaded(true);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setLoaded(true);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K"
        className="gestao-search-trigger"
        onClick={show}
        onFocus={() => setLoaded(true)}
        onPointerEnter={() => setLoaded(true)}
        ref={trigger}
        type="button"
      >
        <GestaoIcon name="search" />
        <span className="gestao-search-trigger-label">Buscar em Gestão</span>
        <kbd>Ctrl K</kbd>
      </button>
      {loaded ? (
        <GestaoSearchDialog
          memberId={memberId}
          onOpenChange={setOpen}
          open={open}
          returnFocusTo={trigger}
        />
      ) : null}
    </>
  );
};
