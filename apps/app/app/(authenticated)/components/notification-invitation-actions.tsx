"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { respondToStudyGroupInvitation } from "../perfil/actions";

type Outcome = "accepted" | "declined" | "already_accepted" | "unavailable";

interface NotificationInvitationActionsProperties {
  readonly invitationId: string;
  readonly onResponded?: () => void;
}

export const NotificationInvitationActions = ({
  invitationId,
  onResponded,
}: NotificationInvitationActionsProperties) => {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{
    readonly status: Outcome;
    readonly slug?: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  const respond = (response: "ACCEPTED" | "DECLINED") => {
    setFailed(false);
    const formData = new FormData();
    formData.set("invitationId", invitationId);
    formData.set("response", response);
    startTransition(async () => {
      try {
        const result = await respondToStudyGroupInvitation(formData);
        if (!result) {
          setFailed(true);
          return;
        }
        setOutcome({
          status: result.status as Outcome,
          slug: "slug" in result ? result.slug : undefined,
        });
        onResponded?.();
      } catch {
        setFailed(true);
      }
    });
  };

  if (outcome) {
    const joined =
      outcome.status === "accepted" || outcome.status === "already_accepted";
    let message = "Este convite não está mais disponível.";
    if (joined) {
      message = "Você entrou no grupo.";
    } else if (outcome.status === "declined") {
      message = "Convite recusado.";
    }
    return (
      <span
        className="mt-3 flex items-center gap-3 text-sm"
        data-testid="notification-invitation-outcome"
      >
        <span className="flex items-center gap-1.5 font-medium text-brand-dark-amaranth">
          {joined ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
          {message}
        </span>
        {joined && outcome.slug ? (
          <Link
            className="text-primary underline underline-offset-4"
            href={`/comunidade/grupos/${outcome.slug}`}
          >
            Abrir grupo
          </Link>
        ) : null}
      </span>
    );
  }

  return (
    <span className="mt-3 flex flex-wrap items-center gap-2">
      <Button
        disabled={pending}
        onClick={() => respond("ACCEPTED")}
        size="sm"
        type="button"
      >
        {pending ? (
          <Loader2Icon aria-hidden="true" className="animate-spin" />
        ) : null}
        Aceitar
      </Button>
      <Button
        disabled={pending}
        onClick={() => respond("DECLINED")}
        size="sm"
        type="button"
        variant="outline"
      >
        Recusar
      </Button>
      {failed ? (
        <span className="text-destructive text-xs" role="alert">
          Não foi possível responder agora. Tente de novo.
        </span>
      ) : null}
    </span>
  );
};
