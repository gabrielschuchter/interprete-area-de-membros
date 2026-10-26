"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  clearGestaoUnsavedChanges,
  hasGestaoUnsavedChanges,
} from "./dirty-registry";
import { GestaoIcon } from "./gestao-icon";

type Banner = "offline" | "online" | "forbidden" | null;
type Pending =
  | { readonly kind: "href"; readonly href: string }
  | { readonly kind: "back" }
  | null;

const signInPath = "/sign-in";
const onlineNoticeMs = 3500;

const draftKey = (memberId: string, pathname: string) =>
  `interprete:gestao:draft:v1:${memberId}:${pathname}`;

const isServerAction = (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  return headers.has("next-action");
};

const collectDraft = () => {
  const draft: Record<string, string> = {};
  for (const field of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("#gestao-main-content form [name]")) {
    if (
      field instanceof HTMLInputElement &&
      ["file", "password", "hidden", "submit", "checkbox", "radio"].includes(
        field.type
      )
    ) {
      continue;
    }
    if (field.name.startsWith("$ACTION") || field.value === "") {
      continue;
    }
    draft[field.name] = field.value;
  }
  return draft;
};

const setNativeValue = (
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) => {
  const prototype = Object.getPrototypeOf(field);
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
};

const restoreDraft = (key: string) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return false;
    }
    sessionStorage.removeItem(key);
    const draft = JSON.parse(raw) as Record<string, string>;
    let restored = false;
    for (const [name, value] of Object.entries(draft)) {
      const field = document.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >(`#gestao-main-content form [name="${CSS.escape(name)}"]`);
      if (field && field.value !== value) {
        setNativeValue(field, value);
        restored = true;
      }
    }
    return restored;
  } catch {
    return false;
  }
};

/**
 * Salvaguardas globais da Gestão: sair com alterações não salvas, sessão
 * expirada, acesso removido, conexão e atalho C. Carregado sob demanda.
 */
export const GestaoGuards = ({ memberId }: { readonly memberId: string }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending>(null);
  const [expired, setExpired] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [restored, setRestored] = useState(false);
  const [entered, setEntered] = useState(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (restoreDraft(draftKey(memberId, pathname))) {
        setRestored(true);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [memberId, pathname]);

  // Chegada à Gestão: anuncia o ambiente novo, uma vez por sessão do navegador.
  useEffect(() => {
    try {
      const key = `interprete:gestao:entered:v1:${memberId}`;
      if (sessionStorage.getItem(key)) {
        return;
      }
      sessionStorage.setItem(key, "1");
    } catch {
      // Sem armazenamento, o aviso aparece só nesta carga.
    }
    setEntered(true);
    const timer = window.setTimeout(() => setEntered(false), 4000);
    return () => window.clearTimeout(timer);
  }, [memberId]);

  // Sair com alterações não salvas: links internos e botão Voltar.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        !hasGestaoUnsavedChanges() ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        url.pathname + url.search ===
          window.location.pathname + window.location.search
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPending({ href: url.pathname + url.search + url.hash, kind: "href" });
    };
    const onPopState = () => {
      if (!hasGestaoUnsavedChanges()) {
        return;
      }
      window.history.pushState(null, "", window.location.href);
      setPending({ kind: "back" });
    };
    const arm = () => {
      if (hasGestaoUnsavedChanges()) {
        window.history.pushState(null, "", window.location.href);
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("gestao:dirty-change", arm, { once: false });
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("gestao:dirty-change", arm);
    };
  }, []);

  // Respostas 401/403 de ações do servidor e sessão que redireciona ao login.
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      if (isServerAction(input, init)) {
        if (response.status === 401 || response.url.includes(signInPath)) {
          try {
            sessionStorage.setItem(
              draftKey(memberId, pathRef.current),
              JSON.stringify(collectDraft())
            );
          } catch {
            // Sem armazenamento: o diálogo ainda orienta a entrar de novo.
          }
          setExpired(true);
          // Mantém a ação pendente: uma resposta de erro derrubaria a tela e
          // com ela o diálogo e o rascunho que acabamos de guardar.
          return new Promise<Response>(() => undefined);
        }
        if (response.status === 403) {
          setBanner("forbidden");
          return new Promise<Response>(() => undefined);
        }
      }
      return response;
    };
    return () => {
      window.fetch = original;
    };
  }, [memberId]);

  // Conexão.
  useEffect(() => {
    let timer: number | undefined;
    const goOffline = () => setBanner("offline");
    const goOnline = () => {
      setBanner("online");
      timer = window.setTimeout(
        () => setBanner((current) => (current === "online" ? null : current)),
        onlineNoticeMs
      );
    };
    if (!navigator.onLine) {
      goOffline();
    }
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.clearTimeout(timer);
    };
  }, []);

  // Atalho C abre Criar, fora de campos de texto.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key.toLowerCase() !== "c" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target?.closest("input, textarea, select, [contenteditable='true']") ||
        document.querySelector("[role='dialog']")
      ) {
        return;
      }
      const trigger = document.querySelector<HTMLElement>(
        ".gestao-create-button"
      );
      if (trigger) {
        event.preventDefault();
        trigger.focus();
        trigger.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const leave = () => {
    const target = pending;
    clearGestaoUnsavedChanges();
    setPending(null);
    if (target?.kind === "href") {
      router.push(target.href);
    } else if (target?.kind === "back") {
      window.history.go(-2);
    }
  };

  return (
    <>
      {banner ? (
        <div
          className="gk-connection"
          data-state={banner}
          role={banner === "online" ? "status" : "alert"}
        >
          <GestaoIcon
            name={banner === "offline" ? "wifi-off" : "alert-circle"}
            size={16}
          />
          {banner === "offline" ? (
            <span>
              Sem conexão. O que você digitou continua nesta tela; salve quando
              a conexão voltar.
            </span>
          ) : null}
          {banner === "online" ? <span>Conexão restabelecida.</span> : null}
          {banner === "forbidden" ? (
            <>
              <span>
                Você não tem mais acesso a esta área. Recarregue para ver o que
                continua disponível.
              </span>
              <button onClick={() => window.location.reload()} type="button">
                Recarregar
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {entered ? (
        <output className="gk-entry-toast">
          Você entrou na Gestão ·{" "}
          <a href="/estudar">Voltar à área de membros</a>
        </output>
      ) : null}
      {restored ? (
        <output className="gk-restored">
          Restauramos o que você tinha digitado antes da sessão expirar.
        </output>
      ) : null}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        open={pending !== null}
      >
        <DialogContent
          className="gk-modal gk-modal--narrow"
          overlayClassName="gk-modal-overlay"
          showCloseButton={false}
        >
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Sair sem salvar?
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                Há alterações que ainda não foram salvas nesta tela. Se sair
                agora, elas serão perdidas.
              </DialogDescription>
            </div>
          </div>
          <div className="gk-modal-foot">
            <span className="gk-spacer" />
            <button className="gk-btn" onClick={leave} type="button">
              Sair
            </button>
            <button
              autoFocus
              className="gk-btn gk-btn--primary"
              onClick={() => setPending(null)}
              type="button"
            >
              Continuar editando
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={() => undefined} open={expired}>
        <DialogContent
          className="gk-modal gk-modal--narrow"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          overlayClassName="gk-modal-overlay"
          showCloseButton={false}
        >
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Entre de novo
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                Sua sessão expirou. O que você digitou ficou guardado neste
                aparelho e volta quando você entrar de novo.
              </DialogDescription>
            </div>
          </div>
          <div className="gk-modal-foot">
            <span className="gk-spacer" />
            <button
              autoFocus
              className="gk-btn gk-btn--primary"
              onClick={() => {
                const back = window.location.pathname + window.location.search;
                window.location.assign(
                  `${signInPath}?redirect_url=${encodeURIComponent(back)}`
                );
              }}
              type="button"
            >
              Entrar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
