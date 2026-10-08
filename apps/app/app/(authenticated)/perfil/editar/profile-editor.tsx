"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon, EyeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { SingleFlightSubmit } from "@/components/mutations/single-flight-form";
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

const ProfileEditor = ({
  completionCount,
  email,
  profile,
}: {
  readonly completionCount: number;
  readonly email: string;
  readonly profile: ProfileEditorValues;
}) => {
  const [values, setValues] = useState<ProfileFormValues>({
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
  });
  const [state, formAction, pending] = useActionState(
    updateProfile,
    actionInitialState
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const lockRef = useRef(false);
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

  return (
    <>
      <section
        aria-label="Completude do perfil"
        className="flex items-center justify-between gap-4 border-border border-y py-3"
      >
        <p className="text-sm">
          Seu perfil está <strong>{completionCount} de 8</strong> itens completo
        </p>
        <Button
          className="shadow-none"
          onClick={() => setPreviewOpen(true)}
          size="default"
          type="button"
          variant="outline"
        >
          <EyeIcon aria-hidden="true" /> Prévia
        </Button>
      </section>

      <form
        action={formAction}
        className="mt-6"
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

        <ProfileAccountSection email={email} />

        {state.status === "error" ? (
          <p
            aria-live="polite"
            className="mt-5 border-destructive border-l-2 bg-destructive/10 px-4 py-3 text-sm"
          >
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-border border-t py-6 sm:flex-row sm:items-center sm:justify-between">
          <Button
            asChild
            className="shadow-none"
            size="default"
            variant="ghost"
          >
            <IntentLink href="/perfil">Descartar alterações</IntentLink>
          </Button>
          <SingleFlightSubmit
            className="shadow-none"
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
