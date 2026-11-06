"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { ArchiveIcon, CheckSquareIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { bulkUpdateMyPosts } from "@/app/(authenticated)/comunidade/actions";

type BulkAction = "archive" | "delete";

interface SelectionContextValue {
  readonly active: boolean;
  readonly selected: ReadonlySet<string>;
  readonly setActive: (value: boolean) => void;
  readonly toggle: (postId: string) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

interface CommunityPublicationSelectionProperties {
  readonly canArchive: boolean;
  readonly children: ReactNode;
  readonly postIds: readonly string[];
  readonly viewLabel: string;
}

/**
 * Modo "Selecionar" de Minhas publicações: o cartão ganha uma caixa de
 * seleção e a barra fixa executa a ação nas publicações marcadas. Vale para
 * todas as abas; arquivar só aparece nas publicadas.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a barra, o diálogo e o estado de seleção vivem juntos de propósito.
export function CommunityPublicationSelection({
  canArchive,
  children,
  postIds,
  viewLabel,
}: CommunityPublicationSelectionProperties) {
  const router = useRouter();
  const [active, setActiveState] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirm, setConfirm] = useState<BulkAction | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const setActive = useCallback((value: boolean) => {
    setActiveState(value);
    setSelected(new Set());
    setError("");
  }, []);
  const toggle = useCallback((postId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ active, selected, setActive, toggle }),
    [active, selected, setActive, toggle]
  );

  let confirmLabel = confirm === "archive" ? "Arquivar" : "Excluir";
  if (isPending) {
    confirmLabel = "Salvando…";
  }
  const allSelected = postIds.length > 0 && selected.size === postIds.length;
  const count = selected.size;

  const run = (action: BulkAction) => {
    setError("");
    startTransition(async () => {
      try {
        const result = await bulkUpdateMyPosts({
          action,
          postIds: [...selected],
        });
        if (result.ok) {
          setConfirm(null);
          setActive(false);
          router.refresh();
          return;
        }
        setError(result.error);
      } catch {
        setError("Não foi possível concluir agora. Tente novamente.");
      }
      setConfirm(null);
    });
  };

  return (
    <SelectionContext.Provider value={value}>
      {postIds.length > 0 ? (
        <div className="community-selection-toolbar">
          {active ? (
            <>
              <Button
                onClick={() =>
                  setSelected(allSelected ? new Set() : new Set(postIds))
                }
                size="sm"
                type="button"
                variant="outline"
              >
                {allSelected ? "Limpar seleção" : "Selecionar todas"}
              </Button>
              <Button
                onClick={() => setActive(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" /> Cancelar
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setActive(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <CheckSquareIcon aria-hidden="true" /> Selecionar
            </Button>
          )}
        </div>
      ) : null}
      {children}
      {active ? (
        <div
          aria-label="Ações em massa"
          className="community-selection-bar"
          role="toolbar"
        >
          <span aria-live="polite" className="community-selection-bar__count">
            {count === 0
              ? "Nenhuma selecionada"
              : `${count} ${count === 1 ? "selecionada" : "selecionadas"}`}
          </span>
          {error ? (
            <span className="community-selection-bar__error" role="alert">
              {error}
            </span>
          ) : null}
          {canArchive ? (
            <Button
              disabled={count === 0 || isPending}
              onClick={() => setConfirm("archive")}
              size="sm"
              type="button"
              variant="outline"
            >
              <ArchiveIcon aria-hidden="true" /> Arquivar
            </Button>
          ) : null}
          <Button
            className="community-selection-bar__delete"
            disabled={count === 0 || isPending}
            onClick={() => setConfirm("delete")}
            size="sm"
            type="button"
            variant="destructive"
          >
            <Trash2Icon aria-hidden="true" /> Excluir
          </Button>
        </div>
      ) : null}
      <AlertDialog
        onOpenChange={(open) => {
          if (!(open || isPending)) {
            setConfirm(null);
          }
        }}
        open={confirm !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "archive" ? "Arquivar" : "Excluir"} {count}{" "}
              {count === 1 ? "publicação" : "publicações"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "archive"
                ? `As publicações saem do feed e ficam em Arquivadas (${viewLabel}).`
                : "A equipe ainda poderá recuperar o conteúdo por até 30 dias."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                if (confirm) {
                  run(confirm);
                }
              }}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SelectionContext.Provider>
  );
}

/** Caixa de seleção de um cartão; some quando o modo "Selecionar" está desligado. */
export const CommunityPublicationSelectBox = ({
  postId,
  title,
}: {
  readonly postId: string;
  readonly title: string;
}) => {
  const context = useContext(SelectionContext);
  if (!context?.active) {
    return null;
  }
  const checked = context.selected.has(postId);
  return (
    <label className="community-select-box" data-checked={checked}>
      <input
        checked={checked}
        onChange={() => context.toggle(postId)}
        type="checkbox"
      />
      <span className="sr-only">
        Selecionar {title || "publicação sem título"}
      </span>
    </label>
  );
};
