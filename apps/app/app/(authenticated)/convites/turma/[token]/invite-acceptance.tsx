"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptGestaoCohortInvite } from "../../../gestao/alunos/turmas/actions";

export const CohortInviteAcceptance = ({
  token,
}: {
  readonly token: string;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const accept = () => {
    startTransition(async () => {
      const result = await acceptGestaoCohortInvite(token);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setAccepted(true);
      setMessage(null);
      router.refresh();
    });
  };

  if (accepted) {
    return (
      <output className="gt-invite-accepted">
        <strong>
          Convite aceito. Sua turma já faz parte dos seus acessos.
        </strong>
        <Button asChild>
          <Link href="/aprender">Ir para Aprender</Link>
        </Button>
      </output>
    );
  }

  return (
    <div className="gt-invite-action">
      {message ? (
        <p className="gt-error-summary" role="alert">
          {message}
        </p>
      ) : null}
      <Button disabled={pending} onClick={accept} type="button">
        {pending ? "Aceitando…" : "Aceitar convite"}
      </Button>
    </div>
  );
};
