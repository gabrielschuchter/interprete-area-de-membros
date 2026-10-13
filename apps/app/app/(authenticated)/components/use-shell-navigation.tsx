"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  isGestaoShellPath,
  safeGestaoReturnPath,
  withGestaoReturnPath,
} from "@/lib/gestao-navigation";

interface PendingNavigation {
  readonly direction: "enter" | "return";
  readonly href: string;
  readonly resolve: () => void;
  skip?: () => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

// This controller lives above both shells; route segment remounts cannot lose it.
export const useShellNavigation = () => {
  const pathname = usePathname();
  const router = useRouter();
  const previous = useRef(pathname);
  const pending = useRef<PendingNavigation | null>(null);
  const returnTo = useRef("/estudar");
  const sequence = useRef(0);
  const [destination, setDestination] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [arrival, setArrival] = useState<"enter" | "return" | null>(null);

  const navigateShell = useCallback(
    (rawHref: string) => {
      if (pending.current) {
        return;
      }
      const url = new URL(rawHref, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }
      const entering = isGestaoShellPath(url.pathname);
      if (entering) {
        returnTo.current = safeGestaoReturnPath(
          `${window.location.pathname}${window.location.search}${window.location.hash}`
        );
      }
      const href = entering
        ? withGestaoReturnPath(
            `${url.pathname}${url.search}${url.hash}`,
            `${window.location.pathname}${window.location.search}${window.location.hash}`
          )
        : `${url.pathname}${url.search}${url.hash}`;
      setFailure(null);
      setAnnouncement("");
      if (!navigator.onLine) {
        setFailure(href);
        return;
      }
      setDestination(href);
      const id = ++sequence.current;
      const direction = entering ? "enter" : "return";
      document.documentElement.dataset.shellTransition = direction;
      let resolveCommit = () => {
        // Assigned synchronously by the Promise executor below.
      };
      const committed = new Promise<void>((resolve) => {
        resolveCommit = resolve;
      });
      const navigation: PendingNavigation = {
        href,
        direction,
        resolve: resolveCommit,
        timer: setTimeout(() => {
          if (pending.current !== navigation) {
            return;
          }
          navigation.skip?.();
          navigation.resolve();
          pending.current = null;
          setDestination(null);
          setFailure(href);
          delete document.documentElement.dataset.shellTransition;
        }, 12_000),
      };
      pending.current = navigation;
      let dispatched = false;
      const update = () => {
        if (!dispatched) {
          dispatched = true;
          router.push(href);
        }
        return committed;
      };
      if (typeof document.startViewTransition === "function") {
        try {
          const transition = document.startViewTransition(update);
          navigation.skip = () => transition.skipTransition();
          // Unsupported snapshots (e.g. duplicate names) still run the update.
          transition.ready.catch(() => {
            document.documentElement.dataset.shellFallback = "true";
          });
          transition.finished
            .catch(() => {
              // A skipped snapshot is not a failed navigation.
            })
            .finally(() => {
              if (!pending.current && sequence.current === id) {
                delete document.documentElement.dataset.shellTransition;
              }
            });
        } catch {
          document.documentElement.dataset.shellFallback = "true";
          update();
        }
      } else {
        document.documentElement.dataset.shellFallback = "true";
        update();
      }
    },
    [router]
  );

  useLayoutEffect(() => {
    const changedShell =
      isGestaoShellPath(previous.current) !== isGestaoShellPath(pathname);
    previous.current = pathname;
    if (!changedShell) {
      return;
    }
    const navigation = pending.current;
    if (!navigation) {
      document.documentElement.dataset.shellFallback = "true";
    }
    if (navigation) {
      clearTimeout(navigation.timer);
      navigation.resolve();
      pending.current = null;
    }
    setDestination(null);
    setFailure(null);
    setArrival(isGestaoShellPath(pathname) ? "enter" : "return");
  }, [pathname]);

  useEffect(() => {
    if (!arrival) {
      return;
    }
    const root = document.documentElement;
    root.dataset.shellArrival = arrival;
    const mainId =
      arrival === "enter" ? "gestao-main-content" : "member-main-content";
    const focus = () => {
      const main = document.getElementById(mainId);
      const heading = main?.querySelector<HTMLElement>("h1");
      if (!heading) {
        return false;
      }
      // A first-visit welcome dialog owns focus until it is dismissed.
      if (!document.querySelector('[role="dialog"][data-state="open"]')) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
      setAnnouncement(
        arrival === "enter"
          ? "Você está na Gestão"
          : "Você voltou à área de membros"
      );
      return true;
    };
    const observer = new MutationObserver(() => {
      if (focus()) {
        observer.disconnect();
      }
    });
    if (!focus()) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    const timer = setTimeout(() => {
      observer.disconnect();
      delete root.dataset.shellArrival;
      delete root.dataset.shellFallback;
      setArrival(null);
    }, 4000);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      delete root.dataset.shellArrival;
      delete root.dataset.shellFallback;
    };
  }, [arrival]);

  useEffect(
    () => () => {
      const navigation = pending.current;
      if (navigation) {
        clearTimeout(navigation.timer);
        navigation.skip?.();
        navigation.resolve();
      }
      delete document.documentElement.dataset.shellTransition;
    },
    []
  );

  const feedback = (
    <>
      <output aria-live="polite" className="sr-only" data-shell-announcement="">
        {announcement}
      </output>
      {destination ? (
        <output aria-live="polite" className="shell-navigation-feedback">
          {isGestaoShellPath(
            new URL(destination, "https://local.invalid").pathname
          )
            ? "Verificando seu acesso…"
            : "Voltando à área de membros…"}
        </output>
      ) : null}
      {arrival === "enter" && !destination && !failure ? (
        <div className="shell-navigation-feedback shell-mobile-arrival">
          Você entrou na Gestão.
          <Link
            href={returnTo.current}
            onClick={(event) => {
              if (
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                navigateShell(returnTo.current);
              }
            }}
            prefetch={false}
          >
            Voltar à área de membros
          </Link>
        </div>
      ) : null}
      {failure ? (
        <div className="shell-navigation-feedback" role="alert">
          Não foi possível abrir o destino. Confira sua conexão e tente
          novamente.
          <Button
            onClick={() => navigateShell(failure)}
            size="sm"
            variant="secondary"
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </>
  );
  return { navigateShell, feedback };
};
