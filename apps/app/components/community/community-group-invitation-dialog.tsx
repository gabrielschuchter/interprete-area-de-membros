"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { type FormEvent, useCallback, useState, useTransition } from "react";
import type { CommunityInviteBatchResult } from "@/app/(authenticated)/comunidade/invitation-actions";
import {
  inviteStudyGroupMembers,
  regenerateCommunityGroupInviteLink,
  revokeCommunityGroupInviteLink,
  revokeStudyGroupInvitation,
} from "@/app/(authenticated)/comunidade/invitation-actions";
import { GroupMemberInvitePicker } from "@/components/community/group-member-invite-picker";

export interface GroupInvitationManagementSnapshot {
  readonly activeLinkCreatedAt: string | null;
  readonly invitations: readonly {
    readonly id: string;
    readonly status: string;
    readonly createdAt: string;
    readonly invitee: {
      readonly displayName: string | null;
      readonly profile: { readonly displayName: string | null } | null;
    };
  }[];
}

const recipientStatusLabel: Record<
  CommunityInviteBatchResult["results"][number]["status"],
  string
> = {
  created: "Convite enviado",
  duplicate_pending: "Já existe um convite pendente",
  already_member: "Esta pessoa já é membro",
  unavailable: "Não foi possível convidar esta pessoa",
};

const batchStatusLabel: Record<CommunityInviteBatchResult["status"], string> = {
  sent: "Convites enviados.",
  partial: "Envio concluído com resultados individuais.",
  forbidden: "Você não tem permissão para convidar neste grupo.",
  invalid: "Selecione até 50 pessoas disponíveis.",
  unauthenticated: "Entre na sua conta para enviar convites.",
};

const invitationStatusLabel: Record<string, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceito",
  DECLINED: "Recusado",
  REVOKED: "Revogado",
};

const revokeInvitationMessage = (status: string | undefined) => {
  switch (status) {
    case "revoked":
      return "Convite revogado.";
    case "forbidden":
      return "Você não tem permissão para revogar este convite.";
    case "unauthenticated":
      return "Entre na sua conta para revogar este convite.";
    case "unavailable":
      return "Este convite já não está pendente ou não está disponível.";
    default:
      return "Não foi possível revogar este convite.";
  }
};

const linkActionLabel = (pending: boolean, active: boolean) => {
  if (pending) {
    return "Aguarde…";
  }
  if (active) {
    return "Regenerar link";
  }
  return "Criar link";
};

export const CommunityGroupInvitationDialog = ({
  groupId,
  memberId,
  management,
}: {
  readonly groupId: string;
  readonly memberId: string;
  readonly management: GroupInvitationManagementSnapshot;
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"link" | "email" | "people">("link");
  const [pending, startTransition] = useTransition();
  const [batchResult, setBatchResult] =
    useState<CommunityInviteBatchResult | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<
    readonly { readonly id: string; readonly name: string }[]
  >([]);
  const [activeLink, setActiveLink] = useState(
    Boolean(management.activeLinkCreatedAt)
  );
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeMessages, setRevokeMessages] = useState<Record<string, string>>(
    {}
  );

  const createLink = () => {
    setLinkMessage(null);
    const formData = new FormData();
    formData.set("groupId", groupId);
    startTransition(async () => {
      const result = await regenerateCommunityGroupInviteLink(formData);
      if (result.status === "created") {
        setActiveLink(true);
        setFreshLink(result.url);
        setCopied(false);
        setLinkMessage(
          "Link criado. O link anterior, se existia, foi revogado."
        );
      } else if (result.status === "forbidden") {
        setLinkMessage(
          "Você não tem permissão para criar ou regenerar o link deste grupo."
        );
      } else {
        setLinkMessage("Não foi possível criar o link deste grupo.");
      }
    });
  };

  const revokeLink = () => {
    setLinkMessage(null);
    const formData = new FormData();
    formData.set("groupId", groupId);
    startTransition(async () => {
      const result = await revokeCommunityGroupInviteLink(formData);
      if (result.status === "revoked" || result.status === "already_revoked") {
        setActiveLink(false);
        setFreshLink(null);
        setCopied(false);
        setLinkMessage("Link revogado. Ele não poderá ser aceito novamente.");
      } else if (result.status === "forbidden") {
        setLinkMessage(
          "Você não tem permissão para revogar o link deste grupo."
        );
      } else {
        setLinkMessage("Não foi possível revogar o link.");
      }
    });
  };

  const copyLink = () => {
    if (!freshLink) {
      return;
    }
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(freshLink);
        setCopied(true);
        setLinkMessage("Link copiado.");
      } catch {
        setLinkMessage(
          "Não foi possível copiar. Selecione e copie o link abaixo."
        );
      }
    });
  };

  const updateSelectedPeople = useCallback(
    (people: readonly { readonly id: string; readonly name: string }[]) => {
      setSelectedPeople(people);
    },
    []
  );

  const submitInvitations = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setBatchResult(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await inviteStudyGroupMembers(formData);
      setBatchResult(result);
    });
  };

  const submitRevokeInvitation = (
    event: FormEvent<HTMLFormElement>,
    invitationId: string
  ) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    setRevokeMessages((current) => ({
      ...current,
      [invitationId]: "Revogando…",
    }));
    startTransition(async () => {
      const result = await revokeStudyGroupInvitation(formData);
      const message = revokeInvitationMessage(result.status);
      setRevokeMessages((current) => ({ ...current, [invitationId]: message }));
    });
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="mt-4 w-full" variant="outline">
          Convidar pessoas
        </Button>
      </DialogTrigger>
      <DialogContent className="inset-x-0 top-auto bottom-0 max-h-[90svh] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl p-5 sm:inset-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85svh] sm:w-[min(44rem,calc(100%-2rem))] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Convidar para o grupo
          </DialogTitle>
          <DialogDescription>
            Convites não dão acesso até a pessoa aceitar. Você pode revogar o
            link a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <div
          aria-label="Formas de convidar"
          className="grid grid-cols-3 border-b"
          role="tablist"
        >
          {(
            [
              ["link", "Link"],
              ["email", "E-mail"],
              ["people", "Pessoas"],
            ] as const
          ).map(([id, label]) => (
            <button
              aria-controls={`invite-panel-${id}`}
              aria-selected={tab === id}
              className={`min-h-11 border-b-2 px-3 text-sm ${tab === id ? "border-brand-structural font-medium text-brand-structural" : "border-transparent text-muted-foreground"}`}
              id={`invite-tab-${id}`}
              key={id}
              onClick={() => setTab(id)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "link" && (
          <section
            aria-labelledby="invite-tab-link"
            className="space-y-4"
            id="invite-panel-link"
            role="tabpanel"
          >
            <div className="rounded-sm border p-4">
              <h3 className="font-medium">Link do grupo</h3>
              <p className="mt-1 text-muted-foreground text-sm leading-5">
                O link não expira por tempo. Regenerar revoga o link atual; quem
                recebe ainda precisa aceitar para entrar.
              </p>
              {freshLink && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="Link de convite"
                    className="h-10 min-w-0 flex-1 rounded-sm border bg-background px-3 text-sm"
                    readOnly
                    value={freshLink}
                  />
                  <Button
                    disabled={pending}
                    onClick={copyLink}
                    type="button"
                    variant="outline"
                  >
                    {copied ? "Copiado" : "Copiar link"}
                  </Button>
                </div>
              )}
              {!freshLink && activeLink && (
                <p className="mt-3 text-muted-foreground text-sm">
                  Há um link ativo. Por segurança, ele não pode ser recuperado
                  depois de fechar esta janela; gere um novo para copiar.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={pending}
                  onClick={createLink}
                  type="button"
                  variant="outline"
                >
                  {linkActionLabel(pending, activeLink)}
                </Button>
                {activeLink ? (
                  <Button
                    disabled={pending}
                    onClick={revokeLink}
                    type="button"
                    variant="ghost"
                  >
                    Revogar link
                  </Button>
                ) : null}
              </div>
            </div>
            {linkMessage && (
              <output aria-live="polite" className="text-sm">
                {linkMessage}
              </output>
            )}
          </section>
        )}

        {tab === "email" && (
          <section
            aria-labelledby="invite-tab-email"
            className="rounded-sm border border-dashed p-4"
            id="invite-panel-email"
            role="tabpanel"
          >
            <h3 className="font-medium">E-mail indisponível</h3>
            <p className="mt-1 text-muted-foreground text-sm leading-5">
              O envio de e-mail ainda não tem um provedor configurado. Nenhuma
              mensagem será enviada por esta opção.
            </p>
          </section>
        )}

        {tab === "people" && (
          <section
            aria-labelledby="invite-tab-people"
            className="space-y-4"
            id="invite-panel-people"
            role="tabpanel"
          >
            <form className="space-y-4" onSubmit={submitInvitations}>
              <input name="groupId" type="hidden" value={groupId} />
              <GroupMemberInvitePicker
                currentMemberId={memberId}
                onSelectionChange={updateSelectedPeople}
              />
              <div className="flex justify-end border-t pt-4">
                <Button disabled={pending} type="submit">
                  {pending ? "Enviando…" : "Enviar convites"}
                </Button>
              </div>
            </form>
            {batchResult && (
              <div
                aria-live="polite"
                className="rounded-sm border p-3"
                data-testid="community-invite-batch-result"
              >
                <p className="font-medium text-sm">
                  {batchStatusLabel[batchResult.status]}
                </p>
                {batchResult.results.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {batchResult.results.map(({ inviteeId, status }) => (
                      <li key={inviteeId}>
                        {selectedPeople.find(({ id }) => id === inviteeId)
                          ?.name ?? "Pessoa selecionada"}
                        : {recipientStatusLabel[status]}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {management.invitations.length > 0 && (
          <section aria-label="Convites enviados" className="border-t pt-4">
            <h3 className="font-medium text-sm">Convites recentes</h3>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {management.invitations.map((invitation) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  key={invitation.id}
                >
                  <span>
                    {invitation.invitee.profile?.displayName ||
                      invitation.invitee.displayName ||
                      "Membro"}
                    <span className="ml-2 text-muted-foreground">
                      {invitationStatusLabel[invitation.status] ?? "Atualizado"}
                    </span>
                  </span>
                  {invitation.status === "PENDING" && (
                    <form
                      onSubmit={(event) =>
                        submitRevokeInvitation(event, invitation.id)
                      }
                    >
                      <input
                        name="invitationId"
                        type="hidden"
                        value={invitation.id}
                      />
                      <Button
                        disabled={pending}
                        size="sm"
                        type="submit"
                        variant="ghost"
                      >
                        {revokeMessages[invitation.id] === "Revogando…"
                          ? "Revogando…"
                          : "Revogar"}
                      </Button>
                    </form>
                  )}
                  {revokeMessages[invitation.id] && (
                    <output
                      aria-live="polite"
                      className="w-full text-muted-foreground text-xs"
                    >
                      {revokeMessages[invitation.id]}
                    </output>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
