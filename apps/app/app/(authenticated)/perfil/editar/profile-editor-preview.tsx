"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { ExternalLinkIcon } from "lucide-react";
import type { ProfileFormValues } from "./profile-editor-sections";

const whitespacePattern = /\s+/;
const publicLinks = [
  { field: "website", label: "Site" },
  { field: "instagram", label: "Instagram" },
  { field: "linkedin", label: "LinkedIn" },
] as const;

export const ProfileEditorPreview = ({
  onOpenChange,
  open,
  values,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly values: ProfileFormValues;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className="max-h-[85svh] overflow-y-auto rounded-none shadow-none sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">
          Prévia do perfil público
        </DialogTitle>
        <DialogDescription>
          Uma visualização do que você está preenchendo. As alterações só ficam
          públicas depois de salvar.
        </DialogDescription>
      </DialogHeader>
      <div className="border-border border-y py-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 shrink-0">
            {values.avatarUrl ? (
              <AvatarImage alt="" src={values.avatarUrl} />
            ) : null}
            <AvatarFallback className="bg-brand-structural text-primary-foreground">
              {(values.displayName || values.username)
                .split(whitespacePattern)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate font-display text-2xl">
              {values.displayName || "Estudante"}
            </h3>
            <p className="text-muted-foreground text-sm">@{values.username}</p>
            {values.headline ? (
              <p className="mt-1 text-sm">{values.headline}</p>
            ) : null}
          </div>
        </div>
        {values.interests.trim() ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {values.interests
              .split(",")
              .map((interest) => interest.trim())
              .filter(Boolean)
              .map((interest) => (
                <li
                  className="border border-border px-2 py-1 text-xs"
                  key={interest}
                >
                  {interest}
                </li>
              ))}
          </ul>
        ) : null}
        {values.bio ? (
          <p className="mt-5 whitespace-pre-wrap text-sm leading-6">
            {values.bio}
          </p>
        ) : null}
        {values.occupation ||
        values.institution ||
        values.city ||
        values.country ? (
          <dl className="mt-5 grid gap-3 border-border border-t pt-4 text-sm sm:grid-cols-2">
            {values.occupation ? (
              <div>
                <dt className="text-muted-foreground text-xs">Profissão</dt>
                <dd className="mt-1">{values.occupation}</dd>
              </div>
            ) : null}
            {values.institution ? (
              <div>
                <dt className="text-muted-foreground text-xs">Instituição</dt>
                <dd className="mt-1">{values.institution}</dd>
              </div>
            ) : null}
            {values.city || values.country ? (
              <div>
                <dt className="text-muted-foreground text-xs">Localização</dt>
                <dd className="mt-1">
                  {[values.city, values.state, values.country]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {publicLinks.some(({ field }) => values[field]) ? (
          <ul
            aria-label="Links"
            className="mt-5 flex flex-wrap gap-4 border-border border-t pt-4"
          >
            {publicLinks
              .filter(({ field }) => values[field])
              .map(({ field, label }) => (
                <li key={field}>
                  <a
                    className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
                    href={values[field]}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {label}
                    <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  </a>
                </li>
              ))}
          </ul>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Seu e-mail não aparece no perfil público.
      </p>
    </DialogContent>
  </Dialog>
);
