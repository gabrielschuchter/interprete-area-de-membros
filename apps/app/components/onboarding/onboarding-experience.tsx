"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  LinkIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  completeOnboarding,
  saveOnboardingStep,
  startOnboarding,
} from "@/app/(onboarding)/onboarding/actions";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import {
  ONBOARDING_FINISH_STEP,
  ONBOARDING_LAST_INPUT_STEP,
  type OnboardingDraft,
  type OnboardingInitialData,
  type OnboardingPreferenceKey,
  type OnboardingPreferences,
} from "./types";

const draftVersion = "v1";
const whitespacePattern = /\s+/;
const protocolPattern = /^https?:\/\//;
const trailingSlashPattern = /\/$/;
const progressDots = ["one", "two", "three", "four", "five", "six"] as const;

const preferenceGroups: readonly {
  readonly label: string;
  readonly items: readonly {
    readonly key: OnboardingPreferenceKey;
    readonly label: string;
  }[];
}[] = [
  {
    label: "Comunidade",
    items: [
      { key: "mentions", label: "Quando alguém mencionar você" },
      { key: "commentReplies", label: "Respostas aos seus comentários" },
      { key: "topicComments", label: "Comentários nos seus tópicos" },
      {
        key: "followedTopicActivity",
        label: "Atualizações de discussões que você segue",
      },
      { key: "groupInvitations", label: "Convites para grupos de estudo" },
      { key: "groupPosts", label: "Novas publicações nos seus grupos" },
    ],
  },
  {
    label: "Aprendizado e prática",
    items: [
      { key: "lessonAvailable", label: "Novas aulas disponíveis" },
      { key: "moduleAvailable", label: "Novos módulos disponíveis" },
      { key: "activityAssigned", label: "Nova atividade" },
      { key: "contentAssignments", label: "Conteúdos atribuídos a você" },
      { key: "feedbackReceived", label: "Feedback recebido" },
      { key: "activityDeadline", label: "Lembretes de prazo" },
    ],
  },
  {
    label: "Avisos",
    items: [{ key: "announcements", label: "Comunicados dos professores" }],
  },
];

const copyDraft = (
  profile: OnboardingInitialData["profile"],
  preferences: OnboardingPreferences
): OnboardingDraft => ({
  ...profile,
  preferences,
});

const initials = (value: string) =>
  value
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

const normalizeUsernameForInput = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

const isEmpty = (value: string) => !value.trim();

const stepDataFor = (step: number, draft: OnboardingDraft) => {
  switch (step) {
    case 1:
      return { displayName: draft.displayName, username: draft.username };
    case 2:
      return { avatarUrl: draft.avatarUrl };
    case 3:
      return {
        headline: draft.headline,
        bio: draft.bio,
        occupation: draft.occupation,
        institution: draft.institution,
        city: draft.city,
        state: draft.state,
        country: draft.country,
        interests: draft.interests,
      };
    case 4:
      return {
        website: draft.website,
        instagram: draft.instagram,
        linkedin: draft.linkedin,
      };
    default:
      return draft.preferences;
  }
};

const identityErrorFor = (draft: OnboardingDraft) => {
  if (isEmpty(draft.displayName)) {
    return { field: "displayName", message: "Escolha um nome para continuar." };
  }
  if (draft.username.length < 3) {
    return {
      field: "username",
      message: "Escolha um username com pelo menos 3 caracteres.",
    };
  }
  return null;
};

interface OnboardingExperienceProperties {
  readonly initial: OnboardingInitialData;
}

export const OnboardingExperience = ({
  initial,
}: OnboardingExperienceProperties) => {
  const router = useRouter();
  const storageKey = `interprete:onboarding:${initial.memberId}:${draftVersion}`;
  const [currentStep, setCurrentStep] = useState(initial.step);
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    copyDraft(initial.profile, initial.preferences)
  );
  const [hydratedDraft, setHydratedDraft] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          readonly draft?: Partial<OnboardingDraft>;
          readonly step?: number;
        };
        const savedDraft = parsed.draft;
        if (savedDraft) {
          setDraft((current) => ({
            ...current,
            ...savedDraft,
            preferences: {
              ...current.preferences,
              ...(savedDraft.preferences ?? {}),
            },
          }));
        }
        if (
          typeof parsed.step === "number" &&
          parsed.step >= initial.step &&
          parsed.step <= ONBOARDING_FINISH_STEP
        ) {
          setCurrentStep(parsed.step);
        }
      }
    } catch {
      // The server is the source of truth. A malformed local draft is safe to ignore.
    } finally {
      setHydratedDraft(true);
    }
  }, [initial.step, storageKey]);

  useEffect(() => {
    if (!hydratedDraft) {
      return;
    }
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ draft, step: currentStep })
      );
    } catch {
      // Persistence on the server remains authoritative when local storage is unavailable.
    }
  }, [currentStep, draft, hydratedDraft, storageKey]);

  const updateField = useCallback(
    <K extends keyof Omit<OnboardingDraft, "preferences">>(
      field: K,
      value: OnboardingDraft[K]
    ) => {
      setDraft((current) => ({ ...current, [field]: value }));
      setError("");
      setFieldError("");
    },
    []
  );

  const updatePreference = useCallback(
    (key: OnboardingPreferenceKey, value: boolean) => {
      setDraft((current) => ({
        ...current,
        preferences: { ...current.preferences, [key]: value },
      }));
      setError("");
    },
    []
  );

  const runAction = useCallback(
    (
      action: () => Promise<{
        readonly ok: boolean;
        readonly message?: string;
        readonly nextStep?: number;
        readonly completed?: boolean;
      }>,
      onSuccess: (result: {
        readonly nextStep?: number;
        readonly completed?: boolean;
      }) => void
    ) => {
      if (isPending) {
        return;
      }
      setError("");
      setFieldError("");
      startTransition(async () => {
        const result = await action();
        if (!result.ok) {
          setError(
            result.message ??
              "Não conseguimos salvar isso agora. Tente novamente."
          );
          return;
        }
        onSuccess(result);
      });
    },
    [isPending]
  );

  const submitCurrentStep = useCallback(() => {
    if (currentStep === 0) {
      runAction(startOnboarding, (result) => {
        setCurrentStep(result.nextStep ?? 1);
      });
      return;
    }

    if (currentStep === ONBOARDING_FINISH_STEP) {
      runAction(completeOnboarding, () => {
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // Nothing else is required for completion.
        }
        router.replace("/");
        router.refresh();
      });
      return;
    }

    if (currentStep < 1 || currentStep > ONBOARDING_LAST_INPUT_STEP) {
      return;
    }

    if (currentStep === 1) {
      const identityError = identityErrorFor(draft);
      if (identityError) {
        setFieldError(identityError.field);
        setError(identityError.message);
        return;
      }
    }

    runAction(
      () =>
        saveOnboardingStep({
          data: stepDataFor(currentStep, draft),
          step: currentStep,
        }),
      (result) => setCurrentStep(result.nextStep ?? currentStep + 1)
    );
  }, [currentStep, draft, router, runAction, storageKey]);

  const goBack = () => {
    if (isPending || currentStep === 0) {
      return;
    }
    setError("");
    setFieldError("");
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const nameForPreview = draft.displayName || initial.displayName;
  const progress = Math.min(Math.max(currentStep, 0), ONBOARDING_FINISH_STEP);
  const profilePreview = useMemo(
    () => ({
      avatarUrl: draft.avatarUrl,
      displayName: nameForPreview,
      username: draft.username,
      headline: draft.headline,
      bio: draft.bio,
      links: [draft.website, draft.instagram, draft.linkedin].filter(Boolean),
    }),
    [
      draft.avatarUrl,
      draft.bio,
      draft.headline,
      draft.instagram,
      draft.linkedin,
      draft.username,
      draft.website,
      nameForPreview,
    ]
  );

  return (
    <main className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-5 py-5 sm:px-8 sm:py-8 lg:px-12">
        <header className="flex items-center justify-between gap-6">
          <Image
            alt="Interprete."
            className="h-auto w-28 sm:w-32"
            height={32}
            priority
            src="/brand/logo/wordmark-amaranto.svg"
            width={128}
          />
          <fieldset
            aria-label="Progresso do onboarding"
            className="flex items-center gap-3"
          >
            <span className="hidden font-data text-[0.65rem] text-muted-foreground uppercase tracking-[0.18em] sm:inline">
              {progress === 0
                ? "vamos começar"
                : `${progress} / ${ONBOARDING_FINISH_STEP}`}
            </span>
            <div aria-hidden="true" className="flex gap-1.5">
              {progressDots.map((dot, index) => (
                <span
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-[var(--motion-duration-fast)] ${
                    index < progress
                      ? "w-5 bg-brand-action"
                      : "w-1.5 bg-brand-structural/20"
                  }`}
                  key={dot}
                />
              ))}
            </div>
          </fieldset>
        </header>

        <div className="my-6 h-px bg-border/70 sm:my-8" />

        <section className="grid flex-1 items-center gap-12 pb-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-20 lg:pb-14">
          <aside className="motion-reveal-editorial max-w-xl">
            <p className="brand-eyebrow">Interprete. · seu primeiro encontro</p>
            <span aria-hidden="true" className="brand-rule mt-4" />
            <h1 className="mt-7 max-w-xl font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
              Um espaço para pensar junto.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground leading-8">
              Vamos deixar seu lugar por aqui com a sua cara — sem pressa e sem
              formulário interminável.
            </p>
            <div className="mt-10 hidden border-brand-action/70 border-l-2 pl-5 text-muted-foreground text-sm leading-6 lg:block">
              <p className="font-display text-foreground text-xl">
                Uma conversa de cada vez.
              </p>
              <p className="mt-2">
                O que você preencher agora já aparece no seu perfil e nas
                discussões da comunidade.
              </p>
            </div>
          </aside>

          <section className="border-border/80 border-t pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-16">
            <div className="motion-focus max-w-2xl" key={currentStep}>
              {currentStep === 0 && (
                <WelcomeStep
                  displayName={nameForPreview}
                  isPending={isPending}
                  onContinue={() => submitCurrentStep()}
                />
              )}
              {currentStep === 1 && (
                <IdentityStep
                  draft={draft}
                  errorField={fieldError}
                  isPending={isPending}
                  onChange={updateField}
                  onContinue={() => submitCurrentStep()}
                />
              )}
              {currentStep === 2 && (
                <AvatarStep
                  draft={draft}
                  error={error}
                  isPending={isPending}
                  isUploading={isAvatarUploading}
                  onAvatarChange={(value) => updateField("avatarUrl", value)}
                  onContinue={() => submitCurrentStep()}
                  onSkip={() => submitCurrentStep()}
                  onUploadingChange={setIsAvatarUploading}
                />
              )}
              {currentStep === 3 && (
                <ContextStep
                  draft={draft}
                  errorField={fieldError}
                  isPending={isPending}
                  onChange={updateField}
                  onContinue={() => submitCurrentStep()}
                  onSkip={() => submitCurrentStep()}
                />
              )}
              {currentStep === 4 && (
                <LinksStep
                  draft={draft}
                  errorField={fieldError}
                  isPending={isPending}
                  onChange={updateField}
                  onContinue={() => submitCurrentStep()}
                  onSkip={() => submitCurrentStep()}
                />
              )}
              {currentStep === 5 && (
                <PreferencesStep
                  draft={draft}
                  isPending={isPending}
                  onChange={updatePreference}
                  onContinue={() => submitCurrentStep()}
                  onSkip={() => submitCurrentStep()}
                />
              )}
              {currentStep === ONBOARDING_FINISH_STEP && (
                <FinishStep
                  isPending={isPending}
                  onContinue={() => submitCurrentStep()}
                  preview={profilePreview}
                />
              )}

              {error ? (
                <p
                  className="mt-6 border-destructive border-l-2 px-4 py-2 text-destructive text-sm"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-border/70 border-t pt-5">
                {currentStep > 0 ? (
                  <button
                    className="inline-flex min-h-11 items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    disabled={isPending}
                    onClick={goBack}
                    type="button"
                  >
                    <ArrowLeftIcon aria-hidden="true" className="size-4" />
                    Voltar
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
};

interface StepFrameProperties {
  readonly actionLabel: string;
  readonly children: React.ReactNode;
  readonly description: string;
  readonly eyebrow: string;
  readonly isPending: boolean;
  readonly onContinue: () => void;
  readonly onSkip?: () => void;
  readonly optional?: boolean;
  readonly pendingLabel?: string;
  readonly title: string;
}

const StepFrame = ({
  actionLabel,
  children,
  description,
  eyebrow,
  isPending,
  onContinue,
  onSkip,
  optional,
  pendingLabel = "Salvando…",
  title,
}: StepFrameProperties) => (
  <div>
    <p className="brand-eyebrow">{eyebrow}</p>
    <h2 className="mt-5 max-w-2xl font-display text-4xl leading-[1.02] sm:text-6xl">
      {title}
    </h2>
    <p className="mt-5 max-w-xl text-muted-foreground leading-7">
      {description}
    </p>
    {optional ? (
      <p className="mt-3 font-data text-[0.68rem] text-muted-foreground uppercase tracking-[0.14em]">
        Opcional · você pode fazer depois
      </p>
    ) : null}
    <div className="mt-9">{children}</div>
    <div className="mt-9 flex flex-wrap items-center gap-4">
      <Button disabled={isPending} onClick={onContinue} type="button">
        {isPending ? pendingLabel : actionLabel}
        {isPending ? null : (
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        )}
      </Button>
      {onSkip ? (
        <button
          className="min-h-11 px-1 text-muted-foreground text-sm underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isPending}
          onClick={onSkip}
          type="button"
        >
          Fazer depois
        </button>
      ) : null}
    </div>
  </div>
);

const WelcomeStep = ({
  displayName,
  isPending,
  onContinue,
}: {
  readonly displayName: string;
  readonly isPending: boolean;
  readonly onContinue: () => void;
}) => (
  <StepFrame
    actionLabel="Começar"
    description="Antes de você entrar, queremos deixar seu espaço com a sua cara. É rápido — e você pode voltar quando quiser."
    eyebrow="Que bom ter você por aqui"
    isPending={isPending}
    onContinue={onContinue}
    title={`Oi, ${displayName}.`}
  >
    <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-brand-action/30 bg-brand-action/10 font-display text-2xl text-brand-structural">
        {initials(displayName)}
      </div>
      <p className="max-w-md font-display text-2xl text-foreground leading-tight">
        Bem-vindo ao Interprete.
      </p>
    </div>
  </StepFrame>
);

const IdentityStep = ({
  draft,
  errorField,
  isPending,
  onChange,
  onContinue,
}: {
  readonly draft: OnboardingDraft;
  readonly errorField: string;
  readonly isPending: boolean;
  readonly onChange: <K extends keyof Omit<OnboardingDraft, "preferences">>(
    field: K,
    value: OnboardingDraft[K]
  ) => void;
  readonly onContinue: () => void;
}) => (
  <StepFrame
    actionLabel="Continuar"
    description="Esse é o nome que outras pessoas verão nas aulas, discussões e encontros. O username vira seu endereço público."
    eyebrow="Primeiro, um detalhe importante"
    isPending={isPending}
    onContinue={onContinue}
    title="Como você quer aparecer por aqui?"
  >
    <div className="grid gap-6 sm:grid-cols-2">
      <label className="block" htmlFor="onboarding-display-name">
        <span className="text-sm">Nome de exibição</span>
        <Input
          aria-invalid={errorField === "displayName"}
          autoComplete="name"
          className="mt-2 h-13 bg-surface-paper"
          id="onboarding-display-name"
          onChange={(event) => onChange("displayName", event.target.value)}
          value={draft.displayName}
        />
      </label>
      <label className="block" htmlFor="onboarding-username">
        <span className="text-sm">Username</span>
        <Input
          aria-describedby="onboarding-username-help"
          aria-invalid={errorField === "username"}
          autoCapitalize="none"
          autoComplete="username"
          className="mt-2 h-13 bg-surface-paper"
          id="onboarding-username"
          onChange={(event) =>
            onChange("username", normalizeUsernameForInput(event.target.value))
          }
          value={draft.username}
        />
        <span
          className="mt-2 block text-muted-foreground text-xs"
          id="onboarding-username-help"
        >
          Seu endereço: /membros/{draft.username || "seu-nome"}
        </span>
      </label>
    </div>
    <p className="mt-7 border-brand-action/60 border-l-2 pl-4 font-display text-foreground text-xl">
      Perfeito, {draft.displayName || "vamos encontrar um nome"} =)
    </p>
  </StepFrame>
);

const AvatarStep = ({
  draft,
  error,
  isPending,
  isUploading,
  onAvatarChange,
  onContinue,
  onUploadingChange,
  onSkip,
}: {
  readonly draft: OnboardingDraft;
  readonly error: string;
  readonly isPending: boolean;
  readonly isUploading: boolean;
  readonly onAvatarChange: (value: string) => void;
  readonly onContinue: () => void;
  readonly onUploadingChange: (isUploading: boolean) => void;
  readonly onSkip: () => void;
}) => (
  <StepFrame
    actionLabel="Continuar"
    description="Uma foto ajuda a reconhecer quem está por trás das perguntas e ideias. É opcional, mas deixa a comunidade mais próxima."
    eyebrow="Um rosto para as conversas"
    isPending={isPending || isUploading}
    onContinue={onContinue}
    onSkip={onSkip}
    optional
    pendingLabel={isUploading ? "Enviando…" : "Salvando…"}
    title="Quer escolher uma foto?"
  >
    <div className="border-border/70 border-y py-5">
      <AvatarUploader
        initials={initials(draft.displayName)}
        initialUrl={draft.avatarUrl || null}
        onUploadingChange={onUploadingChange}
        onValueChange={onAvatarChange}
      />
    </div>
    {error ? (
      <p className="mt-3 text-destructive text-sm">
        Confira a imagem e tente novamente.
      </p>
    ) : null}
    <p className="mt-6 max-w-lg text-muted-foreground text-sm leading-6">
      Se preferir, você pode usar a foto da sua conta por enquanto e trocar
      depois no Perfil.
    </p>
  </StepFrame>
);

const ContextStep = ({
  draft,
  errorField,
  isPending,
  onChange,
  onContinue,
  onSkip,
}: {
  readonly draft: OnboardingDraft;
  readonly errorField: string;
  readonly isPending: boolean;
  readonly onChange: <K extends keyof Omit<OnboardingDraft, "preferences">>(
    field: K,
    value: OnboardingDraft[K]
  ) => void;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
}) => (
  <StepFrame
    actionLabel="Continuar"
    description="Foto, bio e contexto são opcionais, mas ajudam quem encontrar você nas discussões a entender melhor quem você é e o que investiga."
    eyebrow="Um pouco do que você traz"
    isPending={isPending}
    onContinue={onContinue}
    onSkip={onSkip}
    optional
    title="O que você estuda ou pratica?"
  >
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block" htmlFor="onboarding-occupation">
        <span className="text-sm">Profissão ou área</span>
        <Input
          className="mt-2 bg-surface-paper"
          id="onboarding-occupation"
          onChange={(event) => onChange("occupation", event.target.value)}
          value={draft.occupation}
        />
      </label>
      <label className="block" htmlFor="onboarding-institution">
        <span className="text-sm">Instituição</span>
        <Input
          className="mt-2 bg-surface-paper"
          id="onboarding-institution"
          onChange={(event) => onChange("institution", event.target.value)}
          value={draft.institution}
        />
      </label>
    </div>
    <label className="mt-5 block" htmlFor="onboarding-bio">
      <span className="text-sm">Bio curta</span>
      <Textarea
        aria-invalid={errorField === "context"}
        className="mt-2 min-h-28 bg-surface-paper"
        id="onboarding-bio"
        onChange={(event) => onChange("bio", event.target.value)}
        placeholder="O que você quer investigar por aqui?"
        value={draft.bio}
      />
    </label>
    <label className="mt-5 block" htmlFor="onboarding-interests">
      <span className="text-sm">
        Interesses{" "}
        <span className="text-muted-foreground">(separados por vírgula)</span>
      </span>
      <Input
        className="mt-2 bg-surface-paper"
        id="onboarding-interests"
        onChange={(event) => onChange("interests", event.target.value)}
        placeholder="PBE, epidemiologia, leitura crítica"
        value={draft.interests}
      />
    </label>
  </StepFrame>
);

const LinksStep = ({
  draft,
  errorField,
  isPending,
  onChange,
  onContinue,
  onSkip,
}: {
  readonly draft: OnboardingDraft;
  readonly errorField: string;
  readonly isPending: boolean;
  readonly onChange: <K extends keyof Omit<OnboardingDraft, "preferences">>(
    field: K,
    value: OnboardingDraft[K]
  ) => void;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
}) => (
  <StepFrame
    actionLabel="Continuar"
    description="É opcional, mas pode ser legal para quem conhecer você nas discussões conseguir ver mais do seu trabalho."
    eyebrow="Para te encontrar além daqui"
    isPending={isPending}
    onContinue={onContinue}
    onSkip={onSkip}
    optional
    title="Quer deixar algum lugar para te encontrarem?"
  >
    <div className="space-y-5">
      {(
        [
          ["website", "Site", "https://seusite.com"],
          ["instagram", "Instagram", "https://instagram.com/"],
          ["linkedin", "LinkedIn", "https://linkedin.com/in/"],
        ] as const
      ).map(([field, label, placeholder]) => (
        <label className="block" htmlFor={`onboarding-${field}`} key={field}>
          <span className="flex items-center gap-2 text-sm">
            <LinkIcon
              aria-hidden="true"
              className="size-4 text-brand-action-text"
            />
            {label}
          </span>
          <Input
            aria-invalid={errorField === "links"}
            autoCapitalize="none"
            className="mt-2 bg-surface-paper"
            id={`onboarding-${field}`}
            onChange={(event) => onChange(field, event.target.value)}
            placeholder={placeholder}
            type="url"
            value={draft[field]}
          />
        </label>
      ))}
    </div>
  </StepFrame>
);

const PreferencesStep = ({
  draft,
  isPending,
  onChange,
  onContinue,
  onSkip,
}: {
  readonly draft: OnboardingDraft;
  readonly isPending: boolean;
  readonly onChange: (key: OnboardingPreferenceKey, value: boolean) => void;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
}) => (
  <StepFrame
    actionLabel="Guardar preferências"
    description="Tudo começa ligado para você não perder nada importante. Depois, dá para ajustar cada escolha em Configurações."
    eyebrow="O que merece chegar até você"
    isPending={isPending}
    onContinue={onContinue}
    onSkip={onSkip}
    optional
    title="Escolha o ritmo das novidades."
  >
    <div className="space-y-7">
      {preferenceGroups.map((group) => (
        <div key={group.label}>
          <h3 className="font-display text-xl">{group.label}</h3>
          <div className="mt-3 divide-y divide-border/70 border-border/70 border-y">
            {group.items.map((item) => (
              <label
                className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-2 text-sm"
                key={item.key}
              >
                <span className="text-muted-foreground">{item.label}</span>
                <button
                  aria-checked={draft.preferences[item.key]}
                  aria-label={item.label}
                  className={`relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-[var(--motion-duration-fast)] ${draft.preferences[item.key] ? "border-brand-structural bg-brand-structural" : "border-border bg-muted"}`}
                  disabled={isPending}
                  onClick={() =>
                    onChange(item.key, !draft.preferences[item.key])
                  }
                  role="switch"
                  type="button"
                >
                  <span
                    className={`absolute top-1 size-4 rounded-full bg-white transition-transform duration-[var(--motion-duration-fast)] ${draft.preferences[item.key] ? "translate-x-5" : "translate-x-1"}`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  </StepFrame>
);

const FinishStep = ({
  isPending,
  onContinue,
  preview,
}: {
  readonly isPending: boolean;
  readonly onContinue: () => void;
  readonly preview: {
    readonly avatarUrl: string;
    readonly displayName: string;
    readonly username: string;
    readonly headline: string;
    readonly bio: string;
    readonly links: string[];
  };
}) => (
  <StepFrame
    actionLabel="Entrar no Interprete"
    description="Seu espaço está preparado. O que você escolheu agora já fica salvo no seu perfil e nas preferências da plataforma."
    eyebrow="Tudo certo"
    isPending={isPending}
    onContinue={onContinue}
    title="Pronto =)"
  >
    <div className="paper-surface border border-brand-structural/20 p-5 shadow-[var(--shadow-paper)] sm:p-7">
      <div className="flex items-start gap-4">
        <Avatar className="size-16 shrink-0 border border-brand-action/20">
          {preview.avatarUrl ? (
            <AvatarImage alt="" src={preview.avatarUrl} />
          ) : null}
          <AvatarFallback className="bg-brand-structural text-primary-foreground">
            {initials(preview.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-display text-2xl">{preview.displayName}</p>
          <p className="font-data text-muted-foreground text-xs">
            @{preview.username}
          </p>
          {preview.headline ? (
            <p className="mt-3 text-sm">{preview.headline}</p>
          ) : null}
        </div>
      </div>
      {preview.bio ? (
        <p className="mt-5 max-w-xl text-muted-foreground text-sm leading-6">
          {preview.bio}
        </p>
      ) : null}
      {preview.links.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-brand-structural text-xs">
          {preview.links.map((link) => (
            <span className="inline-flex items-center gap-1" key={link}>
              <ExternalLinkIcon aria-hidden="true" className="size-3" />
              {link
                .replace(protocolPattern, "")
                .replace(trailingSlashPattern, "")}
            </span>
          ))}
        </div>
      ) : null}
    </div>
    <p className="mt-6 inline-flex items-center gap-2 text-muted-foreground text-sm">
      <CheckIcon aria-hidden="true" className="size-4 text-brand-action-text" />
      Esse é o seu lugar por aqui.
    </p>
  </StepFrame>
);
