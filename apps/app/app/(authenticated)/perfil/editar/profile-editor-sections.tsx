"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Globe2Icon,
  InstagramIcon,
  LinkedinIcon,
  LockKeyholeIcon,
  PlusIcon,
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
    className="border-border border-b py-6"
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
    className="border-border border-b py-6"
  >
    <SectionHeading heading="Identidade" id="edit-identity-heading" />
    <div className="mt-5 grid gap-y-4">
      <label className="block" htmlFor="profile-displayName">
        <span className="text-sm">Nome de exibição</span>
        <Input
          aria-invalid={Boolean(fieldError("displayName"))}
          className="mt-2 min-h-11 rounded-sm bg-white"
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
        <span className="text-sm">Username</span>
        <div className="mt-2 flex min-h-11 items-center rounded-sm border border-input bg-white focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/35">
          <span className="flex h-10 shrink-0 items-center border-input border-r px-3 font-data text-muted-foreground text-xs">
            /membros/
          </span>
          <Input
            aria-invalid={Boolean(fieldError("username"))}
            className="min-h-10 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
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
    <label className="mt-4 block" htmlFor="profile-headline">
      <span className="flex items-center justify-between gap-3 text-sm">
        Identificação curta
        <span className="font-data text-muted-foreground text-xs">
          {values.headline.length} / 60
        </span>
      </span>
      <Input
        aria-invalid={Boolean(fieldError("headline"))}
        className="mt-2 min-h-11 rounded-sm bg-white"
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
    className="border-border border-b py-6"
  >
    <SectionHeading heading="Contexto" id="edit-context-heading" />
    <div className="mt-5 grid gap-y-4">
      {contextFields.map(({ id, label, maxLength }) => (
        <label className="block" htmlFor={`profile-${id}`} key={id}>
          <span className="text-sm">{label}</span>
          <Input
            aria-invalid={Boolean(fieldError(id))}
            className="mt-2 min-h-11 rounded-sm bg-white"
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
    <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-[1.4fr_0.75fr_1.35fr]">
      {locationFields.map(({ id, label, maxLength, ...attributes }) => (
        <label className="block" htmlFor={`profile-${id}`} key={id}>
          <span className="text-sm">{label}</span>
          <Input
            aria-invalid={Boolean(fieldError(id))}
            className="mt-2 min-h-11 rounded-sm bg-white"
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
    className="border-border border-b py-6"
  >
    <SectionHeading heading="Sobre você" id="edit-about-heading" />
    <label className="mt-5 block" htmlFor="profile-bio">
      <span className="text-sm">Bio</span>
      <Textarea
        aria-invalid={Boolean(fieldError("bio"))}
        className="mt-2 min-h-24 resize-y rounded-sm bg-white"
        id="profile-bio"
        maxLength={280}
        name="bio"
        onChange={(event) => update("bio", event.target.value)}
        placeholder="O que você estuda, pratica ou quer investigar?"
        value={values.bio}
      />
      <span className="mt-1 block text-right text-muted-foreground text-xs">
        {values.bio.length}/280
      </span>
      {fieldError("bio") ? (
        <span className="mt-1 block text-destructive text-xs">
          {fieldError("bio")}
        </span>
      ) : null}
    </label>
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
    <div className="mt-5">
      <label className="block text-sm" htmlFor="profile-interests-input">
        Interesses
      </label>
      <input name="interests" type="hidden" value={value} />
      <div
        aria-invalid={Boolean(fieldError("interests"))}
        className="mt-2 flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm border border-input bg-white px-2 py-1 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/35"
      >
        {interests.map((interest, index) => {
          const occurrence = interests
            .slice(0, index)
            .filter((previous) => previous === interest).length;
          return (
            <span
              className="inline-flex min-h-8 items-center gap-1 rounded-sm bg-brand-pink-essence px-2 font-data text-[0.68rem] text-foreground"
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
                <XIcon aria-hidden="true" className="size-3" />
              </button>
            </span>
          );
        })}
        <Input
          aria-invalid={Boolean(fieldError("interests"))}
          aria-label="Adicionar interesse"
          className="h-9 min-w-32 flex-1 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
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
        <button
          className="inline-flex min-h-9 items-center gap-1 px-2 text-muted-foreground text-xs hover:text-brand-dark-amaranth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={addInterest}
          type="button"
        >
          <PlusIcon aria-hidden="true" className="size-3.5" /> Adicionar
        </button>
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
    className="border-border border-b py-6"
  >
    <SectionHeading heading="Links" id="edit-links-heading" />
    <div className="mt-5 grid gap-4">
      {profileLinks.map(({ id, label, prefix, icon: Icon }) => (
        <label className="block" htmlFor={`profile-${id}`} key={id}>
          <span className="text-sm">{label}</span>
          {(() => {
            const currentValue = values[id];
            const currentPrefix = linkInputPrefix(currentValue, prefix);
            return (
              <div className="mt-2 flex min-h-11 items-center rounded-sm border border-input bg-white focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/35">
                <input name={id} type="hidden" value={currentValue} />
                <span className="flex h-10 shrink-0 items-center gap-1.5 border-input border-r px-3 font-data text-muted-foreground text-xs">
                  <Icon aria-hidden="true" className="size-3.5" />
                  {currentPrefix}
                </span>
                <Input
                  aria-invalid={Boolean(fieldError(id))}
                  className="min-h-10 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
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
    className="border-border border-b py-6"
    id="profile-account"
  >
    <SectionHeading heading="Conta" id="edit-account-heading" />
    <label className="mt-5 block" htmlFor="profile-email">
      <span className="text-sm">E-mail da conta</span>
      <div className="mt-2 flex min-h-11 items-center rounded-sm border border-input bg-[#F7F3F1]">
        <span className="flex h-10 shrink-0 items-center border-input border-r px-3 text-muted-foreground">
          <LockKeyholeIcon aria-hidden="true" className="size-3.5" />
        </span>
        <Input
          className="min-h-10 rounded-none border-0 bg-transparent text-muted-foreground shadow-none focus-visible:ring-0"
          id="profile-email"
          readOnly
          value={email}
        />
      </div>
      <span className="mt-1 block text-muted-foreground text-xs">
        Usado para entrar. Não aparece no perfil público.
      </span>
    </label>
    <label
      className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-sm"
      htmlFor="profile-showInDirectory"
    >
      <input
        checked={values.showInDirectory}
        className="size-4 accent-brand-dark-amaranth"
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
