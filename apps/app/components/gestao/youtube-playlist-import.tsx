"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { PlusIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

interface PlaylistImportModule {
  readonly id: string;
  readonly status: string;
  readonly title: string;
}

interface YouTubePlaylistImportProperties {
  readonly courseId: string;
  readonly courseStatus: string;
  readonly initialIdempotencyKey: string;
  readonly modules: readonly PlaylistImportModule[];
}

const YouTubePlaylistImportDialog = dynamic(
  () =>
    import("./youtube-playlist-import-dialog").then(
      (module) => module.YouTubePlaylistImportDialog
    ),
  {
    ssr: false,
    loading: () => (
      <DialogContent
        aria-busy="true"
        className="gl-playlist-dialog max-h-[92dvh] max-w-[760px] gap-0 overflow-hidden border-[#DED2CF] bg-[#FBF8F5] p-0 sm:max-w-[760px]"
      >
        <DialogHeader className="gl-playlist-dialog-header">
          <p className="gestao-eyebrow">YouTube · aulas</p>
          <DialogTitle className="gl-playlist-dialog-title">
            Importar de uma lista de reprodução
          </DialogTitle>
          <DialogDescription className="gl-playlist-dialog-description">
            Preparando o importador…
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    ),
  }
);

export const YouTubePlaylistImport = ({
  courseId,
  courseStatus,
  initialIdempotencyKey,
  modules,
}: YouTubePlaylistImportProperties) => {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  if (modules.length === 0) {
    return null;
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setHasOpened(true);
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <PlusIcon aria-hidden="true" />
          Importar lista do YouTube
        </Button>
      </DialogTrigger>
      {hasOpened ? (
        <YouTubePlaylistImportDialog
          courseId={courseId}
          courseStatus={courseStatus}
          initialIdempotencyKey={initialIdempotencyKey}
          modules={modules}
          open={open}
        />
      ) : null}
    </Dialog>
  );
};
