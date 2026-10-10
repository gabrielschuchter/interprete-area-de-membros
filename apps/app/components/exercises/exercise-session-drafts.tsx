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
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type DraftSelections = Readonly<Record<string, readonly string[]>>;

const removeStoredDrafts = (storageKey: string) => {
  try {
    window.sessionStorage.removeItem(`exercise-drafts:${storageKey}`);
  } catch {
    // Draft state still works in memory when browser storage is unavailable.
  }
};

interface ExerciseSessionDraftContextValue {
  readonly clearDrafts: () => void;
  readonly draftFor: (questionId: string) => readonly string[];
  readonly hasSelections: boolean;
  readonly requestExit: (destination: string, trigger?: HTMLElement) => void;
  readonly setDraftFor: (
    questionId: string,
    selectedOptionIds: readonly string[]
  ) => void;
}

const ExerciseSessionDraftContext =
  createContext<ExerciseSessionDraftContextValue | null>(null);

export const ExerciseSessionDraftProvider = ({
  children,
  storageKey,
}: {
  readonly children: ReactNode;
  readonly storageKey: string;
}) => {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSelections>({});
  const [storageReady, setStorageReady] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string | null>(
    null
  );
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(
        `exercise-drafts:${storageKey}`
      );
      const value: unknown = raw ? JSON.parse(raw) : {};
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const restored = Object.fromEntries(
          Object.entries(value).flatMap(([questionId, selected]) =>
            questionId.length <= 128 &&
            Array.isArray(selected) &&
            selected.length <= 5 &&
            selected.every(
              (optionId) =>
                typeof optionId === "string" && optionId.length <= 128
            )
              ? [[questionId, [...new Set(selected)] as string[]]]
              : []
          )
        );
        setDrafts((current) => ({ ...restored, ...current }));
      }
    } catch {
      removeStoredDrafts(storageKey);
    } finally {
      setStorageReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }
    const key = `exercise-drafts:${storageKey}`;
    try {
      if (Object.keys(drafts).length) {
        window.sessionStorage.setItem(key, JSON.stringify(drafts));
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Confirmed answers persist server-side; unavailable local storage only
      // prevents keeping unsubmitted selections across navigation.
    }
  }, [drafts, storageKey, storageReady]);
  const draftFor = useCallback(
    (questionId: string) => drafts[questionId] ?? [],
    [drafts]
  );
  const setDraftFor = useCallback(
    (questionId: string, selectedOptionIds: readonly string[]) => {
      setDrafts((current) => {
        if (selectedOptionIds.length === 0) {
          const next = { ...current };
          delete next[questionId];
          return next;
        }
        return { ...current, [questionId]: [...new Set(selectedOptionIds)] };
      });
    },
    []
  );
  const clearDrafts = useCallback(() => {
    setDrafts({});
    removeStoredDrafts(storageKey);
  }, [storageKey]);
  const hasSelections = Object.values(drafts).some(
    (selectedOptionIds) => selectedOptionIds.length > 0
  );

  const requestExit = useCallback(
    (destination: string, trigger?: HTMLElement) => {
      if (hasSelections) {
        returnFocusRef.current = trigger ?? null;
        setPendingDestination(destination);
        return;
      }
      router.push(destination);
    },
    [hasSelections, router]
  );

  useEffect(() => {
    if (!hasSelections) {
      return;
    }
    const interceptLeavingLinks = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) {
        return;
      }
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) {
        return;
      }
      const sessionPath = `/exercicios/sessoes/${encodeURIComponent(storageKey)}`;
      const remainsInSession =
        destination.pathname === sessionPath ||
        destination.pathname.startsWith(`${sessionPath}/`) ||
        (destination.pathname.startsWith("/exercicios/favoritas/") &&
          destination.searchParams.get("sessao") === storageKey);
      if (remainsInSession) {
        return;
      }
      event.preventDefault();
      returnFocusRef.current = anchor;
      setPendingDestination(
        `${destination.pathname}${destination.search}${destination.hash}`
      );
    };
    document.addEventListener("click", interceptLeavingLinks, true);
    return () =>
      document.removeEventListener("click", interceptLeavingLinks, true);
  }, [hasSelections, storageKey]);

  useEffect(() => {
    if (!hasSelections) {
      return;
    }
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [hasSelections]);

  const value = useMemo(
    () => ({
      clearDrafts,
      draftFor,
      hasSelections,
      requestExit,
      setDraftFor,
    }),
    [clearDrafts, draftFor, hasSelections, requestExit, setDraftFor]
  );

  return (
    <ExerciseSessionDraftContext.Provider value={value}>
      {children}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingDestination(null);
            requestAnimationFrame(() => returnFocusRef.current?.focus());
          }
        }}
        open={Boolean(pendingDestination)}
      >
        <DialogContent
          className="top-auto bottom-0 left-0 max-w-none translate-x-0 translate-y-0 gap-5 overscroll-contain rounded-t-2xl px-5 pt-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:top-[50%] md:bottom-auto md:left-[50%] md:max-w-[480px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:p-7"
          role="alertdialog"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Sair da sessão?
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-6">
              Suas respostas confirmadas ficam salvas e você pode retomar de
              onde parou, neste ou em outro dispositivo. As seleções ainda não
              confirmadas serão descartadas ao sair.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-3 md:flex-row">
            <Button
              onClick={() => {
                const destination = pendingDestination;
                setPendingDestination(null);
                clearDrafts();
                if (destination) {
                  router.push(destination);
                }
              }}
              variant="outline"
            >
              Sair da sessão
            </Button>
            <Button onClick={() => setPendingDestination(null)}>
              Continuar sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ExerciseSessionDraftContext.Provider>
  );
};

export const useExerciseSessionDrafts = () => {
  const context = useContext(ExerciseSessionDraftContext);
  if (!context) {
    throw new Error(
      "Exercise session drafts must be used inside ExerciseSessionDraftProvider."
    );
  }
  return context;
};
