"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon, EyeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { SingleFlightSubmit } from "@/components/mutations/single-flight-form";
import { profileCompletionItems } from "@/lib/profile-completion";
import { IntentLink } from "../../components/intent-link";
import { type ProfileUpdateState, updateProfile } from "../actions";
import { ProfileEditorPreview } from "./profile-editor-preview";
import {
  ProfileAboutSection,
  ProfileAccountSection,
  ProfileContextSection,
  type ProfileFieldError,
  type ProfileFormValues,
  ProfileIdentitySection,
  ProfileLinksSection,
  ProfilePhotoSection,
  type ProfileUpdate,
} from "./profile-editor-sections";

export interface ProfileEditorValues {
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly displayName: string | null;
  readonly headline: string | null;
  readonly instagram: string | null;
  readonly institution: string | null;
  readonly interests: string[];
  readonly linkedin: string | null;
  readonly occupation: string | null;
  readonly showInDirectory: boolean;
  readonly state: string | null;
  readonly username: string;
  readonly website: string | null;
}

const actionInitialState: ProfileUpdateState = { status: "idle" };

const getEditorStatusLabel = (
  pending: boolean,
  isUploading: boolean,
  status: ProfileUpdateState["status"],
  hasUnsavedChanges: boolean
) => {
  if (pending) {
    return "Salvando…";
  }
  if (isUploading) {
    return "Enviando foto…";
  }
  if (status === "error") {
    return "Não foi possível salvar";
  }
  return hasUnsavedChanges ? "Alterações não salvas" : "Alterações salvas";
};

const getEditorStatusTone = (
  status: ProfileUpdateState["status"],
  hasUnsavedChanges: boolean,
  isUploading: boolean,
  pending: boolean
) => {
  if (status === "error") {
    return { dot: "bg-destructive", text: "text-destructive" };
  }
  if (hasUnsavedChanges || isUploading || pending) {
    return { dot: "bg-brand-dark-amaranth", text: "text-muted-foreground" };
  }
  return { dot: "bg-muted-foreground", text: "text-muted-foreground" };
};

const ProfileEditor = ({
  email,
  missingLabels,
  profile,
}: {
  readonly email: string;
  readonly missingLabels: readonly string[];
  readonly profile: ProfileEditorValues;
}) => {
  const initialValues: ProfileFormValues = {
    avatarUrl: profile.avatarUrl ?? "",
    bio: profile.bio ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "",
    displayName: profile.displayName ?? "",
    headline: profile.headline ?? "",
    institution: profile.institution ?? "",
    interests: profile.interests.join(", "),
    instagram: profile.instagram ?? "",
    linkedin: profile.linkedin ?? "",
    occupation: profile.occupation ?? "",
    showInDirectory: profile.showInDirectory,
    state: profile.state ?? "",
    username: profile.username,
    website: profile.website ?? "",
  };
  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const [state, formAction, pending] = useActionState(
    updateProfile,
    actionInitialState
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const lockRef = useRef(false);
  const initialValuesRef = useRef(initialValues);
  const router = useRouter();

  useEffect(() => {
    if (!pending) {
      lockRef.current = false;
    }
    if (state.status === "success") {
      router.push("/perfil?saved=1");
    }
  }, [pending, router, state.status]);

  const update: ProfileUpdate = (field, value) =>
    setValues((current) => ({ ...current, [field]: value }));

  const fieldError: ProfileFieldError = (field) => state.fieldErrors?.[field];
  const hasUnsavedChanges =
    JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);
  const statusLabel = getEditorStatusLabel(
    pending,
    isUploading,
    state.status,
    hasUnsavedChanges
  );
  const completion = profileCompletionItems({
    ...values,
    interests: values.interests
      .split(",")
      .map((interest) => interest.trim())
      .filter(Boolean),
  });
  const statusTone = getEditorStatusTone(
    state.status,
    hasUnsavedChanges,
    isUploading,
    pending
  );
  const missingSummary = missingLabels
    .map((label) => label.toLocaleLowerCase("pt-BR"))
    .join(", ");

  return (
    <>
      <section aria-label="Completude do perfil" className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-muted-foreground text-sm leading-6">
            {missingLabels.length > 0
              ? `Faltam ${missingSummary}.`
              : "Seu perfil está completo."}
          </p>
          <p className="shrink-0 font-data text-[0.68rem] text-muted-foreground uppercase tracking-[0.12em]">
            {completion.completedCount} DE {completion.total}
          </p>
        </div>
        <div
          aria-label={`${completion.completedCount} de ${completion.total} itens completos`}
          aria-valuemax={completion.total}
          aria-valuemin={0}
          aria-valuenow={completion.completedCount}
          className="mt-3 grid gap-1.5"
          role="progressbar"
          style={{
            gridTemplateColumns: `repeat(${completion.total}, minmax(0, 1fr))`,
          }}
        >
          {completion.items.map((item) => (
            <span
              aria-hidden="true"
              className={`h-[6px] rounded-full ${item.complete ? "bg-brand-dark-amaranth" : "bg-[var(--line-soft)]"}`}
              key={item.field}
            />
          ))}
        </div>
      </section>

      <form
        action={formAction}
        className="mt-4"
        onSubmit={(event) => {
          if (lockRef.current || pending || isUploading) {
            event.preventDefault();
            return;
          }
          lockRef.current = true;
        }}
      >
        <ProfilePhotoSection
          fieldError={fieldError}
          initialUrl={profile.avatarUrl}
          onUploadingChange={setIsUploading}
          onValueChange={(avatarUrl) => update("avatarUrl", avatarUrl)}
          values={values}
        />
        <ProfileIdentitySection
          fieldError={fieldError}
          update={update}
          values={values}
        />

        <ProfileContextSection
          fieldError={fieldError}
          update={update}
          values={values}
        />

        <ProfileAboutSection
          fieldError={fieldError}
          update={update}
          values={values}
        />

        <ProfileLinksSection
          fieldError={fieldError}
          update={update}
          values={values}
        />

        <ProfileAccountSection email={email} update={update} values={values} />

        {state.status === "error" ? (
          <p
            aria-live="polite"
            className="mt-5 border-destructive border-l-2 bg-destructive/10 px-4 py-3 text-sm"
          >
            {state.message}
          </p>
        ) : null}

        <div className="profile-editor-footer flex flex-col gap-3 border-border border-t py-5 sm:flex-row sm:items-center sm:justify-between">
          <p
            aria-live="polite"
            className={`sr-only flex items-center gap-2 text-xs sm:not-sr-only ${statusTone.text}`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${statusTone.dot}`}
            />
            {statusLabel}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SingleFlightSubmit
              className="w-full shadow-none sm:order-last sm:w-auto"
              disabled={isUploading}
              pendingLabel="Salvando…"
            >
              {isUploading ? (
                "Enviando foto…"
              ) : (
                <>
                  <CheckIcon aria-hidden="true" /> Salvar perfil
                </>
              )}
            </SingleFlightSubmit>
            <div className="flex justify-center gap-2 sm:order-first">
              <Button
                className="order-first shadow-none sm:order-last"
                onClick={() => setPreviewOpen(true)}
                size="default"
                type="button"
                variant="ghost"
              >
                <EyeIcon aria-hidden="true" /> Pré-visualizar
              </Button>
              <Button
                asChild
                className="order-last shadow-none sm:order-first"
                size="default"
                variant="ghost"
              >
                <IntentLink href="/perfil">Descartar</IntentLink>
              </Button>
            </div>
          </div>
        </div>
      </form>

      <ProfileEditorPreview
        onOpenChange={setPreviewOpen}
        open={previewOpen}
        values={values}
      />
    </>
  );
};

export { ProfileEditor };
