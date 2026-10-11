"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";

interface NoteConflictDialogProperties {
  readonly error: string | null;
  readonly loading: boolean;
  readonly localContent: string;
  readonly localTags: string;
  readonly localTitle: string;
  readonly onClose: () => void;
  readonly onKeepLocal: () => Promise<void>;
  readonly onUseServer: () => void;
  readonly saving: boolean;
  readonly serverContent: string;
  readonly serverTags: string;
  readonly serverTitle: string;
  readonly serverUpdatedLabel: string;
  readonly versionAvailable: boolean;
}

export function NoteConflictDialog({
  error,
  loading,
  localContent,
  localTags,
  localTitle,
  onClose,
  onKeepLocal,
  onUseServer,
  saving,
  serverContent,
  serverTags,
  serverTitle,
  serverUpdatedLabel,
  versionAvailable,
}: NoteConflictDialogProperties) {
  const renderConflictContent = () => {
    if (loading) {
      return (
        <p
          aria-live="polite"
          className="py-8 text-center text-[#7A5A69] text-sm"
        >
          Carregando a versão mais recente…
        </p>
      );
    }
    if (error) {
      return (
        <p
          className="rounded-md bg-[#F8E9E9] p-4 text-[#8C1535] text-sm"
          role="alert"
        >
          {error}
        </p>
      );
    }
    if (!versionAvailable) {
      return null;
    }
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-label="Rascunho deste aparelho"
          className="grid content-start gap-2"
        >
          <h3 className="font-medium text-[#40222F]">Neste aparelho</h3>
          <p className="break-words rounded-md border border-[#E2D6D1] bg-white p-3 text-[#40222F] text-sm">
            {localTitle.trim() || "Sem título"}
          </p>
          <pre className="max-h-72 min-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-[#E2D6D1] bg-white p-3 font-sans text-[#604A52] text-sm">
            {localContent || "Nota sem texto."}
          </pre>
          <p className="text-[#7A5A69] text-xs">
            Etiquetas: {localTags.trim() || "nenhuma"}
          </p>
        </section>
        <section
          aria-label="Versão atual do servidor"
          className="grid content-start gap-2"
        >
          <h3 className="font-medium text-[#40222F]">No servidor</h3>
          <p className="break-words rounded-md border border-[#E2D6D1] bg-white p-3 text-[#40222F] text-sm">
            {serverTitle.trim() || "Sem título"}
          </p>
          <pre className="max-h-72 min-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-[#E2D6D1] bg-white p-3 font-sans text-[#604A52] text-sm">
            {serverContent || "Nota sem texto."}
          </pre>
          <p className="text-[#7A5A69] text-xs">
            Atualizada em {serverUpdatedLabel} · Etiquetas:{" "}
            {serverTags || "nenhuma"}
          </p>
        </section>
      </div>
    );
  };

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto border-[#E2D6D1] bg-[#FBF8F5]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#40222F]">
            Conflito entre versões
          </DialogTitle>
          <DialogDescription>
            O rascunho deste aparelho continua preservado. Revise os títulos e
            conteúdos antes de escolher qual versão manter.
          </DialogDescription>
        </DialogHeader>
        {renderConflictContent()}
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button onClick={onClose} type="button" variant="ghost">
            Fechar
          </Button>
          <Button
            disabled={!versionAvailable || loading}
            onClick={onUseServer}
            type="button"
            variant="outline"
          >
            Descartar rascunho e usar servidor
          </Button>
          <Button
            disabled={!versionAvailable || loading || saving}
            onClick={onKeepLocal}
            type="button"
          >
            Manter rascunho e salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
