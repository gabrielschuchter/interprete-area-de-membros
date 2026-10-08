"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
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

const SectionHeading = ({
  eyebrow,
  heading,
  id,
}: {
  readonly eyebrow: string;
  readonly heading: string;
  readonly id: string;
}) => (
  <>
    <p className="brand-eyebrow">{eyebrow}</p>
    <h2 className="mt-1 font-display text-2xl" id={id}>
      {heading}
    </h2>
  </>
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
    <SectionHeading
      eyebrow="Foto"
      heading="Uma imagem para reconhecer você"
      id="edit-photo-heading"
    />
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
    <SectionHeading
      eyebrow="Identidade"
      heading="Como você aparece"
      id="edit-identity-heading"
    />
    <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
      <label className="block" htmlFor="profile-displayName">
        <span className="text-sm">Nome de exibição</span>
        <Input
          aria-invalid={Boolean(fieldError("displayName"))}
          className="mt-2 min-h-11"
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
        <Input
          aria-invalid={Boolean(fieldError("username"))}
          className="mt-2 min-h-11"
          id="profile-username"
          maxLength={30}
          name="username"
          onChange={(event) => update("username", event.target.value)}
          required
          value={values.username}
        />
        {fieldError("username") ? (
          <span className="mt-1 block text-destructive text-xs">
            {fieldError("username")}
          </span>
        ) : (
          <span className="mt-1 block text-muted-foreground text-xs">
            Seu endereço: /membros/{values.username || "username"}
          </span>
        )}
      </label>
    </div>
    <label className="mt-4 block" htmlFor="profile-headline">
      <span className="text-sm">Identificação curta</span>
      <Input
        aria-invalid={Boolean(fieldError("headline"))}
        className="mt-2 min-h-11"
        id="profile-headline"
        maxLength={60}
        name="headline"
        onChange={(event) => update("headline", event.target.value)}
        placeholder="Nutricionista · Interprete"
        value={values.headline}
      />
      <span className="mt-1 block text-right text-muted-foreground text-xs">
        {values.headline.length}/60
      </span>
      {fieldError("headline") ? (
        <span className="mt-1 block text-destructive text-xs">
          {fieldError("headline")}
        </span>
      ) : null}
    </label>
    <label
      className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 text-sm"
      htmlFor="profile-showInDirectory"
    >
      <input
        checked={values.showInDirectory}
        className="mt-1 size-4 accent-brand-dark-amaranth"
        id="profile-showInDirectory"
        onChange={(event) => update("showInDirectory", event.target.checked)}
        type="checkbox"
      />
      <span>
        Aparecer em Explorar membros
        <span className="mt-1 block text-muted-foreground text-xs leading-5">
          Quando desativado, seu perfil deixa de aparecer nas buscas do
          diretório.
        </span>
      </span>
    </label>
    <input
      name="showInDirectory"
      type="hidden"
      value={values.showInDirectory ? "true" : "false"}
    />
  </section>
);

const contextFields = [
  { id: "occupation", label: "Profissão", maxLength: 120 },
  { id: "institution", label: "Instituição", maxLength: 160 },
  { id: "city", label: "Cidade", maxLength: 80 },
  { id: "state", label: "Estado", maxLength: 80 },
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
    <SectionHeading
      eyebrow="Contexto"
      heading="Seu caminho de estudo e trabalho"
      id="edit-context-heading"
    />
    <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
      {contextFields.map(({ id, label, maxLength }) => (
        <label className="block" htmlFor={`profile-${id}`} key={id}>
          <span className="text-sm">{label}</span>
          <Input
            aria-invalid={Boolean(fieldError(id))}
            className="mt-2 min-h-11"
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
    <SectionHeading
      eyebrow="Sobre você"
      heading="O que você quer compartilhar?"
      id="edit-about-heading"
    />
    <label className="mt-5 block" htmlFor="profile-bio">
      <span className="text-sm">Bio</span>
      <Textarea
        aria-invalid={Boolean(fieldError("bio"))}
        className="mt-2 min-h-28"
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
    <label className="mt-5 block" htmlFor="profile-interests">
      <span className="text-sm">Interesses</span>
      <Input
        aria-invalid={Boolean(fieldError("interests"))}
        className="mt-2 min-h-11"
        id="profile-interests"
        maxLength={500}
        name="interests"
        onChange={(event) => update("interests", event.target.value)}
        placeholder="PBE, epidemiologia, leitura crítica"
        value={values.interests}
      />
      <span className="mt-1 block text-muted-foreground text-xs">
        Separe cada interesse por vírgula.
      </span>
      {fieldError("interests") ? (
        <span className="mt-1 block text-destructive text-xs">
          {fieldError("interests")}
        </span>
      ) : null}
    </label>
  </section>
);

const profileLinks = [
  { id: "website", label: "Site" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

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
    <SectionHeading
      eyebrow="Links"
      heading="Onde encontrar você"
      id="edit-links-heading"
    />
    <div className="mt-5 grid gap-4">
      {profileLinks.map(({ id, label }) => (
        <label className="block" htmlFor={`profile-${id}`} key={id}>
          <span className="text-sm">{label}</span>
          <Input
            aria-invalid={Boolean(fieldError(id))}
            className="mt-2 min-h-11"
            id={`profile-${id}`}
            maxLength={300}
            name={id}
            onChange={(event) => update(id, event.target.value)}
            placeholder="https://"
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
  </section>
);

export const ProfileAccountSection = ({
  email,
}: {
  readonly email: string;
}) => (
  <section
    aria-labelledby="edit-account-heading"
    className="border-border border-b py-6"
    id="profile-account"
  >
    <SectionHeading
      eyebrow="Conta"
      heading="Informações privadas"
      id="edit-account-heading"
    />
    <label className="mt-5 block" htmlFor="profile-email">
      <span className="text-sm">E-mail da conta</span>
      <Input
        className="mt-2 min-h-11 bg-muted/40"
        id="profile-email"
        readOnly
        value={email}
      />
      <span className="mt-1 block text-muted-foreground text-xs">
        Seu e-mail não aparece no perfil público.
      </span>
    </label>
  </section>
);
