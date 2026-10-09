"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Globe2Icon,
  InstagramIcon,
  LinkedinIcon,
  LockKeyholeIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { AvatarUploader } from "@/components/profile/avatar-uploader";

export interface ProfileFormValues {
  avatarUrl: string;
  bio: string;
  city: string;
  country: string;
  displayName: string;
  headline: string;
  instagram: string;
  institution: string;
  interests: string;
  linkedin: string;
  occupation: string;
  showInDirectory: boolean;
  state: string;
  username: string;
  website: string;
}

export type ProfileField = keyof ProfileFormValues;
export type ProfileUpdate = <Field extends ProfileField>(
  field: Field,
  value: ProfileFormValues[Field]
) => void;
export type ProfileFieldError = (field: string) => string | undefined;

const whitespacePattern = /\s+/;
const protocolPattern = /^https?:\/\//i;

const SectionHeading = ({
  heading,
  id,
}: {
  readonly heading: string;
  readonly id: string;
}) => (
  <h2 className="font-display text-xl leading-tight" id={id}>
    {heading}
  </h2>
);

const profileInputClass =
  "mt-2 h-12 min-h-12 rounded-[4px] bg-white px-[14px] text-[15px] leading-none md:text-[15px]";
const profileLabelClass = "text-sm font-medium leading-[1.3]";

export const ProfilePhotoSection = ({
  fieldError,
  initialUrl,
  onUploadingChange,
  onValueChange,
  values,
}: {
  readonly fieldError: ProfileFieldError;
  readonly initialUrl: string | null;
  readonly onUploadingChange: (uploading: boolean) => void;
  readonly onValueChange: (avatarUrl: string) => void;
  readonly values: ProfileFormValues;
}) => (
  <section
    aria-labelledby="edit-photo-heading"
    className="mt-12 flex flex-col gap-5"
    id="profile-avatar"
  >
    <SectionHeading heading="Foto" id="edit-photo-heading" />
    <AvatarUploader
      initials={(values.displayName || values.username)
        .split(whitespacePattern)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
      initialUrl={initialUrl}
      onUploadingChange={onUploadingChange}
      onValueChange={onValueChange}
      variant="profile-editor"
    />
    {fieldError("avatarUrl") ? (
      <p className="mt-2 text-destructive text-xs">{fieldError("avatarUrl")}</p>
    ) : null}
  </section>
);

export const ProfileIdentitySection = ({
  fieldError,
  update,
  values,
}: {
  readonly fieldError: ProfileFieldError;
  readonly update: ProfileUpdate;
  readonly values: ProfileFormValues;
}) => (
  <section
    aria-labelledby="edit-identity-heading"
    className="mt-12 flex flex-col gap-5"
  >
    <SectionHeading heading="Identidade" id="edit-identity-heading" />
    <div className="grid gap-y-5">
      <label className="block" htmlFor="profile-displayName">
        <span className={profileLabelClass}>Nome de exibição</span>
        <Input
          aria-invalid={Boolean(fieldError("displayName"))}
          className={profileInputClass}
          id="profile-displayName"
          maxLength={80}
          name="displayName"
          onChange={(event) => update("displayName", event.target.value)}
          value={values.displayName}
        />
        {fieldError("displayName") ? (
          <span className="mt-1 block text-destructive text-xs">
            {fieldError("displayName")}
          </span>
        ) : null}
      </label>
      <label className="block" htmlFor="profile-username">
        <span className={profileLabelClass}>Username</span>
        <div className="mt-2 flex h-12 items-center overflow-hidden rounded-[4px] border border-input bg-white focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/35">
          <span className="flex h-full shrink-0 items-center gap-2 border-input border-r bg-brand-pink-essence px-3 font-data text-[13px] text-muted-foreground">
            /membros/
          </span>
          <Input
            aria-invalid={Boolean(fieldError("username"))}
            className="h-full min-h-12 rounded-none border-0 bg-transparent px-3 text-[15px] leading-none shadow-none focus-visible:ring-0 md:text-[15px]"
            id="profile-username"
            maxLength={30}
            name="username"
            onChange={(event) => update("username", event.target.value)}
            required
            value={values.username}
          />
        </div>
        {fieldError("username") ? (
          <span className="mt-1 block text-destructive text-xs">
            {fieldError("username")}
          </span>
        ) : (
          <span className="mt-1 block text-muted-foreground text-xs">
            Seu endereço público.
          </span>
        )}
      </label>
    </div>
    <label className="block" htmlFor="profile-headline">
      <span
        className={`flex items-center justify-between gap-3 ${profileLabelClass}`}
      >
        Identificação curta
        <span className="font-data text-muted-foreground text-xs tracking-[0.08em]">
          {values.headline.length} / 60
        </span>
      </span>
      <Input
        aria-invalid={Boolean(fieldError("headline"))}
        className={profileInputClass}
        id="profile-headline"
        maxLength={60}
        name="headline"
        onChange={(event) => update("headline", event.target.value)}
        placeholder="Nutricionista · Interprete"
        value={values.headline}
      />
      {fieldError("headline") ? (
        <span className="mt-1 block text-destructive text-xs">
          {fieldError("headline")}
        </span>
      ) : null}
    </label>
  </section>
);

const contextFields = [
  { id: "occupation", label: "Profissão", maxLength: 120 },
  { id: "institution", label: "Instituição", maxLength: 160 },
] as const;

const locationFields = [
  { id: "city", label: "Cidade", maxLength: 80 },
  { id: "state", label: "Estado", maxLength: 80, placeholder: "UF" },
  { id: "country", label: "País", maxLength: 80 },
] as const;

export const ProfileContextSection = ({
  fieldError,
  update,
  values,
}: {
  readonly fieldError: ProfileFieldError;
  readonly update: ProfileUpdate;
  readonly values: ProfileFormValues;
}) => (
  <section
    aria-labelledby="edit-context-heading"
    className="mt-12 flex flex-col gap-5"
  >
    <SectionHeading heading="Contexto" id="edit-context-heading" />
    <div className="grid gap-y-5">
      {contextFields.map(({ id, label, maxLength }) => (
        <label className="block" htmlFor={`profile-${id}`} key={id}>
          <span className={profileLabelClass}>{label}</span>
          <Input
            aria-invalid={Boolean(fieldError(id))}
            className={profileInputClass}
            id={`profile-${id}`}
            maxLength={maxLength}
            name={id}
            onChange={(event) => update(id, event.target.value)}
            value={values[id]}
          />
          {fieldError(id) ? (
            <span className="mt-1 block text-destructive text-xs">
              {fieldError(id)}
            </span>
          ) : null}
        </label>
      ))}
    </div>
    <div className="flex flex-wrap gap-5">
      {locationFields.map(({ id, label, maxLength, ...attributes }) => (
        <label
          className={`min-w-0 ${id === "state" ? "flex-[1_1_90px]" : "flex-[2_1_160px]"}`}
          htmlFor={`profile-${id}`}
          key={id}
        >
          <span className={profileLabelClass}>{label}</span>
          <Input
            aria-invalid={Boolean(fieldError(id))}
            className={profileInputClass}
            id={`profile-${id}`}
            maxLength={maxLength}
            name={id}
            onChange={(event) => update(id, event.target.value)}
            value={values[id]}
            {...attributes}
          />
          {fieldError(id) ? (
            <span className="mt-1 block text-destructive text-xs">
              {fieldError(id)}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  </section>
);

export const ProfileAboutSection = ({
  fieldError,
  update,
  values,
}: {
  readonly fieldError: ProfileFieldError;
  readonly update: ProfileUpdate;
  readonly values: ProfileFormValues;
}) => (
  <section
    aria-labelledby="edit-about-heading"
    className="mt-12 flex flex-col gap-5"
  >
    <SectionHeading heading="Sobre você" id="edit-about-heading" />
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className={profileLabelClass} htmlFor="profile-bio">
          Bio
        </label>
        <span className="font-data text-muted-foreground text-xs tracking-[0.08em]">
          {values.bio.length} / 280
        </span>
      </div>
      <Textarea
        aria-invalid={Boolean(fieldError("bio"))}
        className="min-h-[120px] resize-y rounded-[4px] bg-white px-[14px] py-3 text-[15px] leading-[1.55] focus-visible:border-2 focus-visible:border-brand-dark-amaranth focus-visible:shadow-[0_0_0_3px_rgba(140,21,53,0.14)] focus-visible:ring-0 md:text-[15px]"
        id="profile-bio"
        maxLength={280}
        name="bio"
        onChange={(event) => update("bio", event.target.value)}
        placeholder="O que você estuda, pratica ou quer investigar?"
        rows={4}
        value={values.bio}
      />
      {fieldError("bio") ? (
        <span className="mt-1 block text-destructive text-xs">
          {fieldError("bio")}
        </span>
      ) : null}
    </div>
    <InterestsField
      fieldError={fieldError}
      update={update}
      value={values.interests}
    />
  </section>
);

const InterestsField = ({
  fieldError,
  update,
  value,
}: {
  readonly fieldError: ProfileFieldError;
  readonly update: ProfileUpdate;
  readonly value: string;
}) => {
  const [draft, setDraft] = useState("");
  const interests = value
    .split(",")
    .map((interest) => interest.trim())
    .filter(Boolean);

  const addInterest = () => {
    const nextInterest = draft.trim().replaceAll(",", "");
    if (!nextInterest) {
      return;
    }
    const duplicate = interests.some(
      (interest) =>
        interest.toLocaleLowerCase("pt-BR") ===
        nextInterest.toLocaleLowerCase("pt-BR")
    );
    if (!duplicate) {
      update("interests", [...interests, nextInterest].join(", "));
    }
    setDraft("");
  };

  return (
    <div>
      <label className={profileLabelClass} htmlFor="profile-interests-input">
        Interesses
      </label>
      <input name="interests" type="hidden" value={value} />
      <div
        aria-invalid={Boolean(fieldError("interests"))}
        className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-[4px] border border-input bg-white px-2 py-[7px] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/35"
      >
        {interests.map((interest, index) => {
          const occurrence = interests
            .slice(0, index)
            .filter((previous) => previous === interest).length;
          return (
            <span
              className="inline-flex min-h-8 items-center gap-0.5 rounded-[4px] bg-brand-pink-essence pr-1 pl-3 font-data text-foreground text-xs"
              key={`${interest}-${occurrence}`}
            >
              {interest}
              <button
                aria-label={`Remover interesse ${interest}`}
                className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() =>
                  update(
                    "interests",
                    interests
                      .filter((_, currentIndex) => currentIndex !== index)
                      .join(", ")
                  )
                }
                type="button"
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          );
        })}
        <Input
          aria-invalid={Boolean(fieldError("interests"))}
          aria-label="Adicionar interesse"
          className="h-8 min-w-[120px] flex-[1_1_140px] rounded-none border-0 bg-transparent px-2 text-sm leading-none shadow-none focus-visible:ring-0"
          id="profile-interests-input"
          maxLength={80}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addInterest();
            }
          }}
          placeholder="Adicionar interesse"
          value={draft}
        />
      </div>
      {fieldError("interests") ? (
        <span className="mt-1 block text-destructive text-xs">
          {fieldError("interests")}
        </span>
      ) : null}
    </div>
  );
};

const profileLinks = [
  { id: "website", label: "Site", prefix: "https://", icon: Globe2Icon },
  {
    id: "instagram",
    label: "Instagram",
    prefix: "instagram.com/",
    icon: InstagramIcon,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    prefix: "linkedin.com/in/",
    icon: LinkedinIcon,
  },
] as const;

const stripProtocol = (value: string) => value.replace(protocolPattern, "");
const linkInputPrefix = (value: string, preferred: string) => {
  const withoutProtocol = stripProtocol(value);
  const domain = preferred.replace(protocolPattern, "");
  if (!value || withoutProtocol.toLocaleLowerCase("pt-BR").startsWith(domain)) {
    return preferred;
  }
  if (value.startsWith("http://")) {
    return "http://";
  }
  return "https://";
};
const linkInputValue = (value: string, prefix: string, preferred: string) => {
  const withoutProtocol = stripProtocol(value);
  const domain = preferred.replace(protocolPattern, "");
  if (
    !prefix.endsWith("://") &&
    withoutProtocol.toLocaleLowerCase("pt-BR").startsWith(domain)
  ) {
    return withoutProtocol.slice(domain.length);
  }
  return withoutProtocol;
};
const buildLinkValue = (
  next: string,
  currentValue: string,
  currentPrefix: string,
  preferredPrefix: string
) => {
  if (!next) {
    return "";
  }
  if (currentPrefix.endsWith("://")) {
    const protocol = currentValue.startsWith("http://")
      ? "http://"
      : currentPrefix;
    return `${protocol}${next}`;
  }
  const protocol = currentValue.startsWith("http://") ? "http://" : "https://";
  return `${protocol}${preferredPrefix}${next}`;
};

export const ProfileLinksSection = ({
  fieldError,
  update,
  values,
}: {
  readonly fieldError: ProfileFieldError;
  readonly update: ProfileUpdate;
  readonly values: ProfileFormValues;
}) => (
  <section
    aria-labelledby="edit-links-heading"
    className="mt-12 flex flex-col gap-5"
  >
    <SectionHeading heading="Links" id="edit-links-heading" />
    <div className="grid gap-5">
      {profileLinks.map(({ id, label, prefix, icon: Icon }) => (
        <label className="block" htmlFor={`profile-${id}`} key={id}>
          <span className={profileLabelClass}>{label}</span>
          {(() => {
            const currentValue = values[id];
            const currentPrefix = linkInputPrefix(currentValue, prefix);
            return (
              <div className="mt-2 flex h-12 items-center overflow-hidden rounded-[4px] border border-input bg-white focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/35">
                <input name={id} type="hidden" value={currentValue} />
                <span className="flex h-full shrink-0 items-center gap-2 border-input border-r bg-brand-pink-essence px-3 font-data text-[13px] text-muted-foreground">
                  <Icon aria-hidden="true" className="size-4" />
                  {currentPrefix}
                </span>
                <Input
                  aria-invalid={Boolean(fieldError(id))}
                  className="h-full min-h-12 rounded-none border-0 bg-transparent px-3 text-[15px] leading-none shadow-none focus-visible:ring-0 md:text-[15px]"
                  id={`profile-${id}`}
                  maxLength={300}
                  onChange={(event) => {
                    const next = event.target.value.trimStart();
                    update(
                      id,
                      buildLinkValue(next, currentValue, currentPrefix, prefix)
                    );
                  }}
                  placeholder={
                    currentPrefix.endsWith("://")
                      ? "seusite.com.br"
                      : "seuusuario"
                  }
                  value={linkInputValue(currentValue, currentPrefix, prefix)}
                />
              </div>
            );
          })()}
          {fieldError(id) ? (
            <span className="mt-1 block text-destructive text-xs">
              {fieldError(id)}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  </section>
);

export const ProfileAccountSection = ({
  email,
  update,
  values,
}: {
  readonly email: string;
  readonly update: ProfileUpdate;
  readonly values: ProfileFormValues;
}) => (
  <section
    aria-labelledby="edit-account-heading"
    className="mt-12 flex flex-col gap-5"
    id="profile-account"
  >
    <SectionHeading heading="Conta" id="edit-account-heading" />
    <label className="block" htmlFor="profile-email">
      <span className={profileLabelClass}>E-mail da conta</span>
      <div className="mt-2 flex h-12 items-center gap-2.5 rounded-[4px] border border-input bg-[#F7F3F1] px-3.5 text-muted-foreground">
        <LockKeyholeIcon aria-hidden="true" className="size-4 shrink-0" />
        <Input
          className="h-full min-h-12 rounded-none border-0 bg-transparent px-0 text-[15px] text-muted-foreground leading-none shadow-none focus-visible:ring-0 md:text-[15px]"
          id="profile-email"
          readOnly
          value={email}
        />
      </div>
      <span className="mt-2 block text-[13px] text-muted-foreground leading-[1.4]">
        Usado para entrar. Não aparece no perfil público.
      </span>
    </label>
    <label
      className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] leading-[1.4]"
      htmlFor="profile-showInDirectory"
    >
      <input
        checked={values.showInDirectory}
        className="size-5 accent-primary"
        id="profile-showInDirectory"
        onChange={(event) => update("showInDirectory", event.target.checked)}
        type="checkbox"
      />
      <span>Aparecer em “Explorar membros”</span>
    </label>
    <input
      name="showInDirectory"
      type="hidden"
      value={values.showInDirectory ? "true" : "false"}
    />
  </section>
);
