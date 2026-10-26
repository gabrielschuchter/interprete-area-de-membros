"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptCommunityGroupInviteLink } from "@/app/(authenticated)/comunidade/invitation-actions";

export const AcceptCommunityGroupInvite = ({
  token,
}: {
  readonly token: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const accept = () => {
    setMessage(null);
    const formData = new FormData();
    formData.set("token", token);
    startTransition(async () => {
      const result = await acceptCommunityGroupInviteLink(formData);
      if (result.status === "accepted" || result.status === "already_member") {
        setMessage(
          result.status === "accepted"
            ? "Convite aceito. Você já pode participar do grupo."
            : "Você já faz parte deste grupo."
        );
        router.replace(`/comunidade/grupos/${result.slug}`);
        return;
      }
      setMessage(
        result.status === "unauthenticated"
          ? "Entre na sua conta para aceitar este convite."
          : "Este convite não está mais disponível."
      );
    });
  };

  return (
    <div className="w-full">
      <Button className="w-full" disabled={pending} onClick={accept}>
        {pending ? "Entrando…" : "Entrar no grupo"}
      </Button>
      {message ? (
        <output aria-live="polite" className="mt-3 text-sm">
          {message}
        </output>
      ) : null}
    </div>
  );
};
