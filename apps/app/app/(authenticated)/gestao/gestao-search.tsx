"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
      <Button
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Buscar em Gestão"
        className="size-10 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={show}
        onFocus={() => setLoaded(true)}
        onPointerEnter={() => setLoaded(true)}
        ref={trigger}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <SearchIcon aria-hidden="true" />
      </Button>
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
