"use client";

import { useClerk } from "@repo/auth/client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  checkOnboardingUsername,
  completeOnboarding,
  importAccountPhoto,
  saveOnboardingStep,
  skipOnboardingStep,
  startOnboarding,
} from "@/app/(onboarding)/onboarding/actions";
import { notificationPreferenceGroups } from "@/lib/notification-preference-groups";
import { onboardingCopy as copy } from "@/lib/onboarding/copy";
import {
  DISPLAY_NAME_MAX,
  firstName,
  localUsernameStatus,
  typedUsername,
  usernameFromName,
  validDisplayName,
} from "@/lib/onboarding/identity";
import {
  displayProfileLink,
  normalizeProfileLink,
} from "@/lib/onboarding/links";
import {
  essentialNotificationPreferences,
  type NotificationPreset,
  presetFor,
  presetPreferences,
} from "@/lib/onboarding/notification-presets";
import {
  LAST_STEP_INDEX,
  onboardingStepPath,
  onboardingSteps,
} from "@/lib/onboarding/steps";
import type {
  OnboardingFailureCode,
  OnboardingResult,
  OnboardingState,
  UsernameCheck,
} from "@/lib/onboarding/types";
import { Carteirinha, CarteirinhaStrip } from "./carteirinha";

const PhotoCropper = dynamic(
  () => import("./photo-cropper").then((module) => module.PhotoCropper),
  { ssr: false }
);

const BIO_MAX = 240;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SEEN_KEY = "interprete.onboarding.seen";

type SaveState = "idle" | "saving" | "saved";
type UsernameState =
  | { readonly status: "idle" | "checking" | "offline" }
  | (UsernameCheck & { readonly value: string });

const safeStorage = {
  get: (key: string) => {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Private windows can refuse storage; the screen works without it.
    }
  },
};

const Check = () => (
  <svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14">
    <path
      d="M3 8.5L6.5 12L13 4.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const Warning = () => (
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
    <path
      d="M8 2L15 14H1L8 2Z M8 6.5V9.5 M8 11.5V11.6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const Spinner = () => <span aria-hidden="true" className="ob-spinner" />;

const Note = ({ children }: { readonly children: ReactNode }) => (
  <p className="ob-note">{children}</p>
);

const failureMessage = (code: OnboardingFailureCode) =>
  code === "RATE_LIMITED"
    ? "Vamos com calma. Tenta de novo em alguns segundos?"
    : copy.erroGenerico;

export const OnboardingFlow = ({
  initialStep,
  state,
}: {
  readonly initialStep: number;
  readonly state: OnboardingState;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this unit deliberately keeps one step workflow (validation, saving state, offline and session handling) together.
}) => {
  const router = useRouter();
  const { signOut } = useClerk();
  const heading = useRef<HTMLHeadingElement | null>(null);
  const step = onboardingSteps[initialStep];

  const [saveState, setSaveState] = useState<SaveState>(
    state.status === "IN_PROGRESS" && state.reachedStep > 1 ? "saved" : "idle"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [resume, setResume] = useState(false);

  const [name, setName] = useState(state.identity.displayName);
  const [username, setUsername] = useState(state.identity.username);
  const [usernameTouched, setUsernameTouched] = useState(
    state.identity.usernameFromAccount
  );
  const [usernameState, setUsernameState] = useState<UsernameState>({
    status: "idle",
  });
  const [avatarUrl, setAvatarUrl] = useState(state.avatarUrl);
  const [about, setAbout] = useState({
    ...state.about,
    instagram: displayProfileLink("instagram", state.about.instagram),
  });
  const [linksOpen, setLinksOpen] = useState(
    Boolean(
      state.about.website || state.about.instagram || state.about.linkedin
    )
  );
  const [bioCut, setBioCut] = useState(false);
  const [linkErrors, setLinkErrors] = useState<Record<string, boolean>>({});
  const [themes, setThemes] = useState<readonly string[]>(state.interests);
  const [preferences, setPreferences] = useState(state.preferences);
  const [preset, setPreset] = useState<NotificationPreset>(
    presetFor(state.preferences)
  );

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // The welcome-back screen shows once per browser session, not on reloads.
  useEffect(() => {
    if (
      state.status === "IN_PROGRESS" &&
      state.reachedStep > 0 &&
      !safeStorage.get(SEEN_KEY)
    ) {
      setResume(true);
    }
    safeStorage.set(SEEN_KEY, "1");
  }, [state.reachedStep, state.status]);

  // Username check: 400 ms after the person stops typing.
  useEffect(() => {
    if (step.slug !== "identidade") {
      return;
    }
    const local = localUsernameStatus(username);
    if (local === "empty") {
      setUsernameState({ status: "idle" });
      return;
    }
    if (local === "short" || local === "invalid") {
      setUsernameState({ status: local, suggestions: [], value: username });
      return;
    }
    setUsernameState({ status: "checking" });
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const result = await checkOnboardingUsername(username, name);
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setUsernameState({ ...result.data, value: username });
        } else if (result.code === "UNAUTHENTICATED") {
          setSessionExpired(true);
        } else {
          setUsernameState({ status: "offline" });
        }
      } catch {
        if (!cancelled) {
          setUsernameState({ status: "offline" });
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [name, step.slug, username]);

  const run = useCallback(
    async <T,>(
      task: () => Promise<OnboardingResult<T>>
    ): Promise<OnboardingResult<T> | null> => {
      setBusy(true);
      setError(null);
      setSaveState("saving");
      try {
        const result = await task();
        if (result.ok) {
          setSaveState("saved");
          return result;
        }
        setSaveState("idle");
        if (result.code === "UNAUTHENTICATED") {
          setSessionExpired(true);
        } else if (
          result.code !== "USERNAME_TAKEN" &&
          result.code !== "USERNAME_RESERVED"
        ) {
          setError(failureMessage(result.code));
        }
        return result;
      } catch {
        setSaveState("idle");
        setError(copy.erroGenerico);
        return null;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const goTo = (index: number) => router.push(onboardingStepPath(index));
  const back = () => goTo(initialStep - 1);

  const themesForCard = useMemo(() => themes, [themes]);
  const cardProps = {
    avatarUrl,
    displayName: name,
    institution: about.institution,
    memberSince: state.memberSince,
    occupation: about.occupation,
    themes: themesForCard,
    username,
  };

  // --- identity ----------------------------------------------------------
  const onName = (value: string) => {
    setName(value);
    if (!usernameTouched) {
      setUsername(usernameFromName(value));
    }
  };
  const nameValid = validDisplayName(name);
  const usernameFree =
    usernameState.status !== "idle" &&
    usernameState.status !== "checking" &&
    (usernameState.status === "offline" ||
      ("value" in usernameState &&
        usernameState.value === username &&
        usernameState.status === "free"));
  const canContinueIdentity = nameValid && usernameFree && online;

  const continueIdentity = async () => {
    if (!canContinueIdentity) {
      return;
    }
    const result = await run(() =>
      saveOnboardingStep({
        step: "identidade",
        displayName: name.trim(),
        username,
      })
    );
    if (result?.ok) {
      goTo(2);
    } else if (
      result &&
      (result.code === "USERNAME_TAKEN" || result.code === "USERNAME_RESERVED")
    ) {
      setUsernameState({
        status: result.code === "USERNAME_TAKEN" ? "taken" : "reserved",
        suggestions: result.suggestions ?? [],
        value: username,
      });
    }
  };

  // --- photo -------------------------------------------------------------
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropBlob, setCropBlob] = useState<Blob | null>(null);
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [removedPhoto, setRemovedPhoto] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sheet, setSheet] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      if (cropPreview) {
        URL.revokeObjectURL(cropPreview);
      }
    },
    [cropPreview]
  );

  const onCrop = useCallback((blob: Blob | null) => {
    setCropBlob(blob);
    setCropPreview(blob ? URL.createObjectURL(blob) : null);
  }, []);

  const pickFile = (file: File | undefined) => {
    setSheet(false);
    setDragging(false);
    if (!file) {
      return;
    }
    if (!AVATAR_TYPES.has(file.type)) {
      setPhotoError(copy.foto.erroFormato);
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setPhotoError(
        copy.foto.erroTamanho((file.size / 1024 / 1024).toFixed(1))
      );
      return;
    }
    setPhotoError(null);
    setRemovedPhoto(null);
    setCropSource(URL.createObjectURL(file));
  };

  const useAccountPhoto = async () => {
    setSheet(false);
    setPhotoError(null);
    const result = await run(() => importAccountPhoto());
    if (result?.ok) {
      setCropSource(null);
      setCropBlob(null);
      setCropPreview(null);
      setRemovedPhoto(null);
      setAvatarUrl(result.data.url);
    } else if (result) {
      setError(null);
      setPhotoError(copy.foto.erroConta);
    }
  };

  const removePhoto = () => {
    setSheet(false);
    setRemovedPhoto(avatarUrl || cropSource || "");
    setCropSource(null);
    setCropBlob(null);
    setCropPreview(null);
    setAvatarUrl("");
  };

  const undoRemove = () => {
    if (removedPhoto) {
      setAvatarUrl(removedPhoto);
    }
    setRemovedPhoto(null);
  };

  const uploadCropped = async (): Promise<string | null> => {
    if (!cropBlob) {
      return avatarUrl || null;
    }
    const form = new FormData();
    form.set(
      "file",
      new File([cropBlob], "avatar.webp", { type: "image/webp" })
    );
    form.set("assetType", "avatar");
    const response = await fetch("/api/member-assets", {
      body: form,
      method: "POST",
    });
    if (response.status === 401) {
      setSessionExpired(true);
      return null;
    }
    const payload = (await response.json().catch(() => ({}))) as {
      url?: string;
    };
    if (!(response.ok && payload.url)) {
      throw new Error("upload");
    }
    return payload.url;
  };

  const continuePhoto = async () => {
    setBusy(true);
    setPhotoError(null);
    let url: string | null;
    try {
      url = await uploadCropped();
    } catch {
      setBusy(false);
      setPhotoError(copy.foto.erroUpload);
      return;
    }
    setBusy(false);
    if (url === null && cropBlob) {
      return;
    }
    const result = await run(() =>
      saveOnboardingStep({ step: "foto", avatarUrl: url })
    );
    if (result?.ok) {
      goTo(3);
    }
  };

  // --- about -------------------------------------------------------------
  const onBio = (value: string) => {
    setBioCut(value.length > BIO_MAX);
    setAbout((current) => ({ ...current, bio: value.slice(0, BIO_MAX) }));
  };

  const continueAbout = async () => {
    const errors = {
      website: normalizeProfileLink("website", about.website) === null,
      instagram: normalizeProfileLink("instagram", about.instagram) === null,
      linkedin: normalizeProfileLink("linkedin", about.linkedin) === null,
    };
    setLinkErrors(errors);
    if (errors.website || errors.instagram || errors.linkedin) {
      setLinksOpen(true);
      return;
    }
    const result = await run(() =>
      saveOnboardingStep({ step: "sobre", ...about })
    );
    if (result?.ok) {
      goTo(4);
    }
  };

  // --- interests / notices / finish -------------------------------------
  const toggleTheme = (theme: string) =>
    setThemes((current) =>
      current.includes(theme)
        ? current.filter((item) => item !== theme)
        : [...current, theme]
    );

  const choosePreset = (next: NotificationPreset) => {
    setPreset(next);
    if (next === "um") {
      if (presetFor(preferences) !== "um") {
        setPreferences({ ...essentialNotificationPreferences });
      }
    } else {
      setPreferences(presetPreferences(next));
    }
  };

  const continueSimple = async (
    payload: Parameters<typeof saveOnboardingStep>[0],
    next: number
  ) => {
    const result = await run(() => saveOnboardingStep(payload));
    if (result?.ok) {
      goTo(next);
    }
  };

  const skip = async () => {
    const result = await run(() => skipOnboardingStep(step.slug));
    if (result?.ok) {
      goTo(initialStep + 1);
    }
  };

  const start = async () => {
    const result = await run(() => startOnboarding());
    if (result?.ok) {
      goTo(1);
    }
  };

  const finish = async (destination: string) => {
    const result = await run(() => completeOnboarding());
    if (result?.ok) {
      router.push(destination);
      router.refresh();
    } else if (result && result.code !== "UNAUTHENTICATED") {
      setError(copy.conclusao.erroFinalizar);
    }
  };

  const pending = [
    avatarUrl ? null : "Foto",
    state.about.bio ? null : "Bio",
    state.about.website || state.about.instagram || state.about.linkedin
      ? null
      : "Links (site, Instagram, LinkedIn)",
    state.interests.length > 0 ? null : "Interesses",
  ].filter((item): item is string => item !== null);

  const saveLabel = {
    idle: copy.salvo.inicial,
    saved: initialStep === LAST_STEP_INDEX ? copy.salvo.final : copy.salvo.ok,
    saving: copy.salvo.salvando,
  }[saveState];

  const welcome = initialStep === 0;
  const last = initialStep === LAST_STEP_INDEX;
  const note = {
    "boas-vindas": copy.boasVindas.nota,
    identidade: copy.identidade.nota,
    foto: avatarUrl || cropPreview ? copy.foto.nota : null,
    sobre: copy.sobre.nota,
    interesses: copy.interesses.nota,
    avisos: copy.avisos.nota,
    conclusao: copy.conclusao.nota,
  }[step.slug];

  const dots = onboardingSteps.map((item, index) => {
    const done = index < initialStep;
    const current = index === initialStep;
    let dotState = "todo";
    if (current) {
      dotState = "current";
    } else if (done) {
      dotState = "done";
    }
    const content = <span className="ob-dot" data-state={dotState} />;
    return (
      <li
        aria-current={current ? "step" : undefined}
        aria-label={copy.a11yEtapa(index + 1, item.name)}
        key={item.slug}
      >
        {done ? (
          <Link
            aria-label={copy.a11yEtapa(index + 1, item.name)}
            className="ob-dot-link"
            href={onboardingStepPath(index)}
          >
            {content}
          </Link>
        ) : (
          content
        )}
      </li>
    );
  });

  const actionsDisabled = busy || !online;
  const primary = (label: string, onClick: () => void, disabled = false) => (
    <button
      className="ob-btn"
      disabled={actionsDisabled || disabled}
      onClick={onClick}
      type="button"
    >
      {label}
      <span aria-hidden="true">→</span>
    </button>
  );

  const resumePanel = (
    <section aria-labelledby="ob-resume" className="ob-resume">
      <h1 id="ob-resume" ref={heading} tabIndex={-1}>
        {copy.retomada.titulo(firstName(state.identity.displayName))}
      </h1>
      <p>
        {copy.retomada.texto(
          onboardingSteps[state.reachedStep]?.name ?? onboardingSteps[0].name
        )}
      </p>
      <div className="ob-actions">
        <button
          className="ob-btn"
          onClick={() => {
            setResume(false);
            if (state.reachedStep !== initialStep) {
              goTo(state.reachedStep);
            }
          }}
          type="button"
        >
          {copy.retomada.continuar}
        </button>
        <button
          className="ob-link"
          onClick={() => {
            setResume(false);
            goTo(0);
          }}
          type="button"
        >
          {copy.retomada.recomecar}
        </button>
      </div>
    </section>
  );

  const nav = (extra?: ReactNode) => (
    <>
      {initialStep > 0 ? (
        <div className="ob-back">
          <button className="ob-link-quiet" onClick={back} type="button">
            <span aria-hidden="true">←</span> {copy.acao.voltar}
          </button>
        </div>
      ) : null}
      {extra}
    </>
  );

  const mobileBar = (
    primaryNode: ReactNode,
    skippable: boolean,
    backEnabled = initialStep > 0
  ) => (
    <div className="ob-bar">
      <div className="ob-bar-row">
        {backEnabled ? (
          <button
            aria-label={copy.acao.voltar}
            className="ob-bar-back"
            onClick={back}
            type="button"
          >
            ←
          </button>
        ) : null}
        {primaryNode}
      </div>
      {skippable ? (
        <button
          className="ob-link ob-bar-skip"
          disabled={actionsDisabled}
          onClick={skip}
          type="button"
        >
          {copy.acao.pular}
        </button>
      ) : null}
    </div>
  );

  const errorLine = error ? (
    <p className="ob-error" role="alert">
      <Warning /> {error}
    </p>
  ) : null;

  const continueRow = (
    label: string,
    onClick: () => void,
    skippable: boolean,
    disabled = false,
    beside?: ReactNode
  ) => (
    <>
      <div className="ob-row ob-row-desktop">
        {primary(busy ? copy.foto.enviandoBotao : label, onClick, disabled)}
        {skippable ? (
          <button
            className="ob-link"
            disabled={actionsDisabled}
            onClick={skip}
            type="button"
          >
            {copy.acao.pular}
          </button>
        ) : null}
        {beside}
      </div>
      {mobileBar(
        <button
          className="ob-btn ob-btn-wide"
          disabled={actionsDisabled || disabled}
          onClick={onClick}
          type="button"
        >
          {label}
          <span aria-hidden="true">→</span>
        </button>,
        skippable
      )}
    </>
  );

  const heading1 = (title: string) => (
    <h1 className="ob-h1" ref={heading} tabIndex={-1}>
      {title}
    </h1>
  );

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this unit deliberately keeps one step workflow (validation, saving state, offline and session handling) together.
  const stepBody = () => {
    switch (step.slug) {
      case "boas-vindas":
        return (
          <div className="ob-welcome">
            <h1 className="ob-display" ref={heading} tabIndex={-1}>
              {copy.boasVindas.titulo}
            </h1>
            <p className="ob-sub">{copy.boasVindas.subtitulo}</p>
            <p className="ob-lead">{copy.boasVindas.texto}</p>
            <div className="ob-row ob-row-desktop">
              {primary(copy.boasVindas.cta, start)}
            </div>
            <p className="ob-reassure">
              <Check />
              <span className="ob-wide-only">{copy.boasVindas.rodape}</span>
              <span className="ob-narrow-only">
                {copy.boasVindas.rodapeCurto}
              </span>
            </p>
            {errorLine}
            <div className="ob-bar">
              <div className="ob-bar-row">
                <button
                  className="ob-btn ob-btn-wide"
                  disabled={actionsDisabled}
                  onClick={start}
                  type="button"
                >
                  {copy.boasVindas.cta}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
        );
      case "identidade": {
        const status = usernameState.status;
        const suggestions =
          "suggestions" in usernameState ? usernameState.suggestions : [];
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this unit deliberately keeps one step workflow (validation, saving state, offline and session handling) together.
        const message = (() => {
          if (status === "checking") {
            return (
              // biome-ignore lint/a11y/useSemanticElements: role follows the approved state catalog; native elements would change announcement and layout.
              <p className="ob-help" role="status">
                <Spinner /> {copy.identidade.verificando}
              </p>
            );
          }
          if (status === "free") {
            return (
              // biome-ignore lint/a11y/useSemanticElements: role follows the approved state catalog; native elements would change announcement and layout.
              <p className="ob-help ob-help-ok" role="status">
                <b>{copy.identidade.livre}</b>{" "}
                <span>{copy.identidade.endereco(username)}</span>
              </p>
            );
          }
          if (status === "short") {
            return (
              <p className="ob-help ob-help-error" id="ob-user-help">
                <Warning /> {copy.identidade.curto}
              </p>
            );
          }
          if (status === "invalid") {
            return (
              <p className="ob-help ob-help-error" id="ob-user-help">
                <Warning /> {copy.identidade.invalido}
              </p>
            );
          }
          if (status === "taken" || status === "reserved") {
            return (
              <div className="ob-help ob-help-error" id="ob-user-help">
                <p>
                  <Warning />{" "}
                  {status === "taken"
                    ? copy.identidade.ocupado
                    : copy.identidade.reservado}
                  {suggestions.length === 0 ? " outro?" : ""}
                </p>
                {suggestions.length > 0 ? (
                  <div className="ob-suggestions">
                    {suggestions.map((suggestion) => (
                      <button
                        className="ob-mono ob-suggestion"
                        key={suggestion}
                        onClick={() => {
                          setUsernameTouched(true);
                          setUsername(suggestion);
                        }}
                        type="button"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }
          if (status === "offline") {
            return (
              // biome-ignore lint/a11y/useSemanticElements: role follows the approved state catalog; native elements would change announcement and layout.
              <p className="ob-help" role="status">
                {copy.identidade.checagemFalhou}
              </p>
            );
          }
          return null;
        })();
        const pendingMessage = nameValid
          ? copy.identidade.pendenteUsername
          : copy.identidade.pendenteNome;
        const longName = name.trim().length > DISPLAY_NAME_MAX;
        return (
          <div>
            {state.hasPriorProfile && !resume ? (
              <p className="ob-prior">
                <b>{copy.antigo.titulo}</b> {copy.antigo.texto}
              </p>
            ) : null}
            {heading1(copy.identidade.titulo)}
            <p className="ob-lead">{copy.identidade.texto}</p>
            <div className="ob-field">
              <label htmlFor="ob-name">
                {copy.identidade.campoNome}
                {state.identity.displayNameFromAccount &&
                name === state.identity.displayName ? (
                  <span className="ob-mono ob-pill">
                    {state.hasPriorProfile
                      ? copy.sobre.seloPerfil
                      : copy.identidade.seloCadastro}
                  </span>
                ) : null}
              </label>
              <input
                aria-describedby={longName ? "ob-name-help" : undefined}
                aria-invalid={longName || undefined}
                autoComplete="name"
                id="ob-name"
                onChange={(event) => onName(event.target.value)}
                placeholder={copy.identidade.placeholderNome}
                type="text"
                value={name}
              />
              {longName ? (
                <p className="ob-help ob-help-error" id="ob-name-help">
                  <Warning /> {copy.identidade.nomeLongo}
                </p>
              ) : null}
            </div>
            <div className="ob-field">
              <label htmlFor="ob-username">
                {copy.identidade.campoUsername}
              </label>
              <div
                className="ob-affix"
                data-invalid={
                  status === "taken" ||
                  status === "reserved" ||
                  status === "invalid" ||
                  undefined
                }
              >
                <span aria-hidden="true" className="ob-mono">
                  @
                </span>
                <input
                  aria-describedby="ob-user-help"
                  aria-invalid={
                    status === "taken" ||
                    status === "reserved" ||
                    status === "invalid" ||
                    undefined
                  }
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  className="ob-mono"
                  id="ob-username"
                  onChange={(event) => {
                    setUsernameTouched(true);
                    setUsername(typedUsername(event.target.value));
                  }}
                  placeholder={copy.identidade.placeholderUsername}
                  spellCheck={false}
                  type="text"
                  value={username}
                />
              </div>
              <div aria-live="polite">{message}</div>
            </div>
            {errorLine}
            <div className="ob-row ob-row-desktop">
              {primary(
                copy.acao.continuar,
                continueIdentity,
                !canContinueIdentity
              )}
              {canContinueIdentity ? (
                <span className="ob-echo">
                  {copy.identidade.eco(firstName(name))}
                </span>
              ) : (
                <span className="ob-pending">{pendingMessage}</span>
              )}
            </div>
            {mobileBar(
              <button
                className="ob-btn ob-btn-wide"
                disabled={actionsDisabled || !canContinueIdentity}
                onClick={continueIdentity}
                type="button"
              >
                {copy.acao.continuar}
                <span aria-hidden="true">→</span>
              </button>,
              false
            )}
          </div>
        );
      }
      case "foto": {
        const shown = cropPreview ?? avatarUrl;
        const hasPhoto = Boolean(shown || cropSource);
        const size = 176;
        return (
          <div>
            {heading1(copy.foto.titulo)}
            <p className="ob-lead">{copy.foto.texto}</p>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="ob-hidden-input"
              onChange={(event) => {
                pickFile(event.target.files?.[0]);
                event.target.value = "";
              }}
              ref={fileInput}
              tabIndex={-1}
              type="file"
            />
            <input
              accept="image/*"
              capture="user"
              className="ob-hidden-input"
              onChange={(event) => {
                pickFile(event.target.files?.[0]);
                event.target.value = "";
              }}
              ref={cameraInput}
              tabIndex={-1}
              type="file"
            />
            {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop zone and backdrop only add drag-and-drop or click-outside; every action also has a button. */}
            <section
              aria-label={copy.foto.titulo}
              className="ob-photo"
              data-dragging={dragging || undefined}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                pickFile(event.dataTransfer.files?.[0]);
              }}
            >
              {dragging ? (
                <div className="ob-drop">
                  <p className="ob-drop-title">{copy.foto.arrastando}</p>
                  <p>{copy.foto.dica}</p>
                </div>
              ) : (
                <>
                  <div className="ob-photo-stage">
                    {cropSource ? (
                      <PhotoCropper
                        onChange={onCrop}
                        size={size}
                        source={cropSource}
                      />
                    ) : (
                      <div
                        className="ob-photo-circle"
                        data-has-photo={hasPhoto}
                      >
                        {shown ? (
                          // biome-ignore lint/performance/noImgElement: private member-assets route.
                          <img alt="" height={size} src={shown} width={size} />
                        ) : (
                          <span aria-hidden="true">
                            {name.trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ob-photo-actions">
                    <div className="ob-photo-buttons">
                      <button
                        className="ob-btn-outline ob-wide-only"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                        type="button"
                      >
                        {hasPhoto ? copy.foto.trocar : copy.foto.escolher}
                      </button>
                      <button
                        className="ob-btn-outline ob-narrow-only"
                        disabled={busy}
                        onClick={() => setSheet(true)}
                        type="button"
                      >
                        {hasPhoto ? copy.foto.trocar : copy.foto.escolher}
                      </button>
                      {hasPhoto ? (
                        <button
                          className="ob-link"
                          onClick={removePhoto}
                          type="button"
                        >
                          {copy.foto.remover}
                        </button>
                      ) : null}
                      {!hasPhoto && state.accountPhotoAvailable ? (
                        <button
                          className="ob-btn-outline ob-wide-only"
                          disabled={busy}
                          onClick={useAccountPhoto}
                          type="button"
                        >
                          {copy.foto.conta}
                        </button>
                      ) : null}
                    </div>
                    <p className="ob-hint">{copy.foto.dica}</p>
                  </div>
                </>
              )}
            </section>
            <div aria-live="polite">
              {busy && cropBlob ? (
                // biome-ignore lint/a11y/useSemanticElements: role follows the approved state catalog; native elements would change announcement and layout.
                <p className="ob-help" role="status">
                  <Spinner /> {copy.foto.enviando}
                </p>
              ) : null}
              {photoError ? (
                <p className="ob-help ob-help-error ob-boxed" role="alert">
                  <Warning /> {photoError}
                </p>
              ) : null}
              {removedPhoto !== null ? (
                // biome-ignore lint/a11y/useSemanticElements: role follows the approved state catalog; native elements would change announcement and layout.
                <p className="ob-help ob-toast" role="status">
                  {copy.foto.removida}{" "}
                  <button
                    className="ob-link"
                    onClick={undoRemove}
                    type="button"
                  >
                    {copy.foto.desfazer}
                  </button>
                </p>
              ) : null}
            </div>
            {errorLine}
            {continueRow(copy.acao.continuar, continuePhoto, true)}
            <p className="ob-reassure ob-reassure-plain">{copy.foto.semFoto}</p>
            {sheet ? (
              // biome-ignore lint/a11y/noStaticElementInteractions: backdrop closes on click or Escape; the sheet has its own Cancel button.
              <div
                className="ob-sheet-backdrop"
                onClick={() => setSheet(false)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSheet(false);
                  }
                }}
                role="presentation"
              >
                {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop zone and backdrop only add drag-and-drop or click-outside; every action also has a button. */}
                <div
                  aria-label={copy.foto.folhaTitulo}
                  aria-modal="true"
                  className="ob-sheet"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  role="dialog"
                >
                  <h2>{copy.foto.folhaTitulo}</h2>
                  <button
                    onClick={() => cameraInput.current?.click()}
                    type="button"
                  >
                    {copy.foto.folhaCamera}
                  </button>
                  <button
                    onClick={() => fileInput.current?.click()}
                    type="button"
                  >
                    {copy.foto.folhaGaleria}
                  </button>
                  {state.accountPhotoAvailable ? (
                    <button onClick={useAccountPhoto} type="button">
                      {copy.foto.conta}
                    </button>
                  ) : null}
                  {hasPhoto ? (
                    <button
                      className="ob-sheet-danger"
                      onClick={removePhoto}
                      type="button"
                    >
                      {copy.foto.folhaRemover}
                    </button>
                  ) : null}
                  <button
                    className="ob-sheet-cancel"
                    onClick={() => setSheet(false)}
                    type="button"
                  >
                    {copy.foto.folhaCancelar}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      }
      case "sobre":
        return (
          <div>
            {heading1(copy.sobre.titulo)}
            <p className="ob-lead">
              <span className="ob-wide-only">{copy.sobre.texto}</span>
              <span className="ob-narrow-only">{copy.sobre.textoCurto}</span>
            </p>
            <div className="ob-two">
              <div className="ob-field">
                <label htmlFor="ob-occupation">{copy.sobre.profissao}</label>
                <input
                  id="ob-occupation"
                  maxLength={80}
                  onChange={(event) =>
                    setAbout({ ...about, occupation: event.target.value })
                  }
                  type="text"
                  value={about.occupation}
                />
              </div>
              <div className="ob-field">
                <label htmlFor="ob-institution">{copy.sobre.instituicao}</label>
                <input
                  id="ob-institution"
                  maxLength={80}
                  onChange={(event) =>
                    setAbout({ ...about, institution: event.target.value })
                  }
                  type="text"
                  value={about.institution}
                />
              </div>
            </div>
            <div className="ob-field">
              <label htmlFor="ob-bio">{copy.sobre.bio}</label>
              <textarea
                aria-describedby="ob-bio-help"
                id="ob-bio"
                onChange={(event) => onBio(event.target.value)}
                placeholder={copy.sobre.bioPlaceholder}
                value={about.bio}
              />
              <div className="ob-count" id="ob-bio-help">
                {bioCut ? (
                  <span className="ob-help-error">
                    <Warning /> {copy.sobre.bioCortada}
                  </span>
                ) : (
                  <span>{copy.sobre.bioAjuda}</span>
                )}
                <span className="ob-mono">
                  {about.bio.length} / {BIO_MAX}
                </span>
              </div>
            </div>
            {linksOpen ? (
              <div className="ob-links">
                {(
                  [
                    ["website", copy.sobre.site, copy.sobre.sitePlaceholder],
                    [
                      "instagram",
                      copy.sobre.instagram,
                      copy.sobre.instagramPlaceholder,
                    ],
                    [
                      "linkedin",
                      copy.sobre.linkedin,
                      copy.sobre.linkedinPlaceholder,
                    ],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <div className="ob-field ob-field-tight" key={key}>
                    <label className="ob-sr" htmlFor={`ob-${key}`}>
                      {label}
                    </label>
                    <input
                      aria-invalid={linkErrors[key] || undefined}
                      autoCapitalize="none"
                      id={`ob-${key}`}
                      inputMode="url"
                      onChange={(event) =>
                        setAbout({ ...about, [key]: event.target.value })
                      }
                      placeholder={placeholder}
                      type="text"
                      value={about[key]}
                    />
                    {linkErrors[key] ? (
                      <p className="ob-help ob-help-error">
                        <Warning /> {copy.sobre.linksErro}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <button
                aria-expanded="false"
                className="ob-links-toggle"
                onClick={() => setLinksOpen(true)}
                type="button"
              >
                <span aria-hidden="true" className="ob-plus">
                  +
                </span>
                <span>
                  {copy.sobre.linksAbrir}{" "}
                  <span className="ob-muted">
                    {copy.sobre.linksAbrirDetalhe}
                  </span>
                </span>
              </button>
            )}
            {errorLine}
            {continueRow(copy.acao.continuar, continueAbout, true)}
          </div>
        );
      case "interesses":
        return (
          <div>
            {heading1(copy.interesses.titulo)}
            <p className="ob-lead">
              <span className="ob-wide-only">{copy.interesses.texto}</span>
              <span className="ob-narrow-only">
                {copy.interesses.textoCurto}
              </span>
            </p>
            <p aria-live="polite" className="ob-mono ob-counter">
              {copy.interesses.contador(themes.length)}
            </p>
            <div className="ob-chips">
              {state.categories.map((category) => {
                const selected = themes.includes(category);
                return (
                  <button
                    aria-pressed={selected}
                    className="ob-chip"
                    key={category}
                    onClick={() => toggleTheme(category)}
                    type="button"
                  >
                    {selected ? <span aria-hidden="true">✓ </span> : null}
                    {category}
                  </button>
                );
              })}
            </div>
            {errorLine}
            {continueRow(
              copy.acao.continuar,
              () =>
                continueSimple({ step: "interesses", interests: themes }, 5),
              true
            )}
          </div>
        );
      case "avisos": {
        const options: readonly {
          readonly detail: string;
          readonly label: string;
          readonly value: NotificationPreset;
          readonly badge?: string;
        }[] = [
          {
            value: "tudo",
            label: copy.avisos.tudo,
            detail: copy.avisos.tudoDetalhe,
            badge: copy.avisos.tudoSelo,
          },
          {
            value: "essencial",
            label: copy.avisos.essencial,
            detail: copy.avisos.essencialDetalhe,
          },
          { value: "um", label: copy.avisos.um, detail: copy.avisos.umDetalhe },
        ];
        return (
          <div>
            {heading1(copy.avisos.titulo)}
            <p className="ob-lead">{copy.avisos.texto}</p>
            <div
              aria-label={copy.avisos.titulo}
              className="ob-options"
              role="radiogroup"
            >
              {options.map((option) => (
                <label
                  className="ob-option"
                  data-checked={preset === option.value || undefined}
                  key={option.value}
                >
                  <input
                    checked={preset === option.value}
                    name="ob-preset"
                    onChange={() => choosePreset(option.value)}
                    type="radio"
                  />
                  <span aria-hidden="true" className="ob-radio" />
                  <span>
                    <span className="ob-option-title">
                      {option.label}
                      {option.badge ? (
                        <span className="ob-mono ob-pill">{option.badge}</span>
                      ) : null}
                    </span>
                    <span className="ob-option-detail">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>
            {preset === "um" ? (
              <div className="ob-switches">
                {notificationPreferenceGroups.map((group) => (
                  <fieldset key={group.label}>
                    <legend className="ob-mono">{group.label}</legend>
                    {group.items.map((item) => (
                      <label className="ob-switch" key={item.key}>
                        <span>{item.label}</span>
                        <button
                          aria-checked={preferences[item.key]}
                          className="ob-toggle"
                          onClick={() =>
                            setPreferences({
                              ...preferences,
                              [item.key]: !preferences[item.key],
                            })
                          }
                          role="switch"
                          type="button"
                        >
                          <span />
                        </button>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            ) : null}
            {error ? (
              <p className="ob-error ob-boxed" role="alert">
                <Warning /> {copy.avisos.erroGuardar}
              </p>
            ) : null}
            {continueRow(
              copy.avisos.cta,
              () => continueSimple({ step: "avisos", preferences }, 6),
              true
            )}
          </div>
        );
      }
      default:
        return (
          <div className="ob-welcome">
            <h1 className="ob-display" ref={heading} tabIndex={-1}>
              {copy.conclusao.titulo}
            </h1>
            <p className="ob-sub">
              {copy.conclusao.subtitulo(firstName(name) || "")}
            </p>
            {state.hasCohort ? null : (
              <p className="ob-lead">{copy.conclusao.semTurma}</p>
            )}
            <div className="ob-row ob-row-desktop">
              <button
                className="ob-btn"
                disabled={actionsDisabled}
                onClick={() => finish("/")}
                type="button"
              >
                {busy ? (
                  <>
                    <Spinner /> {copy.conclusao.finalizando}
                  </>
                ) : (
                  <>
                    {copy.conclusao.cta}
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
              <button
                className="ob-link"
                disabled={actionsDisabled}
                onClick={() => finish("/perfil/editar")}
                type="button"
              >
                {copy.conclusao.secundario}
              </button>
            </div>
            {errorLine}
            {pending.length > 0 ? (
              <div className="ob-later">
                <p className="ob-mono">{copy.conclusao.pendenciasTitulo}</p>
                <ul>
                  {pending.map((item) => (
                    <li key={item}>
                      <span>{item}</span>
                      <Link href="/perfil/editar">
                        {copy.conclusao.pendenciasLink}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {mobileBar(
              <button
                className="ob-btn ob-btn-wide"
                disabled={actionsDisabled}
                onClick={() => finish("/")}
                type="button"
              >
                {copy.conclusao.cta}
                <span aria-hidden="true">→</span>
              </button>,
              false
            )}
            <button
              className="ob-link ob-bar-skip ob-narrow-only ob-bar-secondary"
              disabled={actionsDisabled}
              onClick={() => finish("/perfil/editar")}
              type="button"
            >
              {copy.conclusao.secundario}
            </button>
          </div>
        );
    }
  };

  const notificationExamples = (
    <div aria-hidden="true" className="ob-examples">
      <div className="ob-example">
        <span className="ob-mono">COMUNIDADE · AGORA</span>
        <p>Mariana mencionou você em “Como ler um forest plot?”</p>
      </div>
      <div className="ob-example ob-example-b">
        <span className="ob-mono">CURSOS · HOJE</span>
        <p>Nova aula disponível no módulo de Leitura crítica</p>
      </div>
      <div className="ob-example ob-example-c">
        <span className="ob-mono">PRAZO · AMANHÃ</span>
        <p>Sua atividade vence amanhã, às 23h59</p>
      </div>
    </div>
  );

  return (
    <div className="ob" data-resume={resume || undefined} data-step={step.slug}>
      <header className="ob-header">
        <span className="ob-brand">{copy.marca}</span>
        <div className="ob-header-end">
          <span aria-live="polite" className="ob-saved">
            {saveState === "saving" ? <Spinner /> : <Check />} {saveLabel}
          </span>
          <ol aria-label="Progresso" className="ob-dots">
            {dots}
          </ol>
          <button
            className="ob-link-quiet ob-signout"
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            type="button"
          >
            {copy.acao.sair}
          </button>
        </div>
      </header>

      {online ? null : (
        // biome-ignore lint/a11y/useSemanticElements: role follows the approved state catalog; native elements would change announcement and layout.
        <p className="ob-offline" role="status">
          <Warning /> {copy.offline}
        </p>
      )}

      <div aria-hidden="true" className="ob-column" />

      <main className="ob-main">
        {resume ? null : (
          <aside className="ob-side">
            {step.slug === "avisos" ? (
              <div className="ob-side-examples">{notificationExamples}</div>
            ) : (
              <>
                {initialStep >= 1 && !last ? (
                  <CarteirinhaStrip
                    avatarUrl={cropPreview ?? avatarUrl}
                    displayName={name}
                    themes={themesForCard}
                    username={username}
                  />
                ) : null}
                <div
                  className="ob-card-wrap"
                  data-hide-mobile={
                    initialStep >= 1 && !last ? true : undefined
                  }
                >
                  <Carteirinha
                    {...cardProps}
                    avatarUrl={cropPreview ?? avatarUrl}
                    blank={welcome}
                    stamped={last}
                  />
                </div>
              </>
            )}
            {note ? <Note>{note}</Note> : null}
          </aside>
        )}
        <section className="ob-panel" key={step.slug}>
          {resume ? resumePanel : stepBody()}
          {resume ? null : nav()}
        </section>
      </main>
      <div aria-hidden="true" className="ob-footer-meander ob-meander" />

      {sessionExpired ? (
        <div className="ob-modal-backdrop">
          <div
            aria-labelledby="ob-session-title"
            aria-modal="true"
            className="ob-modal"
            role="alertdialog"
          >
            <h2 id="ob-session-title">{copy.sessao.titulo}</h2>
            <p>{copy.sessao.texto}</p>
            <button
              className="ob-btn"
              onClick={() => {
                router.push(
                  `/sign-in?redirect_url=${encodeURIComponent(onboardingStepPath(initialStep))}`
                );
              }}
              type="button"
            >
              {copy.sessao.botao}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
