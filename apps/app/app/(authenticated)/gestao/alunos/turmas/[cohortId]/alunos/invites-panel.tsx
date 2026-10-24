"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GestaoIcon } from "../../../../gestao-icon";
import { revokeGestaoCohortInvite } from "../../actions";

export interface PendingInviteRow {
  readonly ageLabel: string;
  readonly email: string | null;
  readonly id: string;
  readonly usage: string;
}

export const InvitesPanel = ({
  cohortId,
  invites,
  total,
}: {
  readonly cohortId: string;
  readonly invites: readonly PendingInviteRow[];
  readonly total: number;
}) => {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const revoke = (inviteId: string) =>
    startTransition(async () => {
      const result = await revokeGestaoCohortInvite({
        cohortId,
        inviteId,
        idempotencyKey: crypto.randomUUID(),
      });
      setStatus(result.ok ? "Convite cancelado." : result.message);
      if (result.ok) {
        router.refresh();
      }
    });
  return (
    <section aria-labelledby="pending-invites" className="gk-panel">
      <h2 className="gk-panel-title" id="pending-invites">
        Convites pendentes · {total}
      </h2>
      <ul className="gk-rows">
        {invites.map((invite) => (
          <li key={invite.id}>
            <GestaoIcon name={invite.email ? "inbox" : "link"} size={16} />
            <span className="gk-row-copy">
              <strong>{invite.email ?? "Link de convite"}</strong>
              <small>{invite.usage}</small>
            </span>
            <small className="gk-muted">{invite.ageLabel}</small>
            <button
              className="gk-text-btn"
              disabled={pending}
              onClick={() => revoke(invite.id)}
              type="button"
            >
              Cancelar
            </button>
          </li>
        ))}
      </ul>
      {status ? <output className="gk-hint">{status}</output> : null}
    </section>
  );
};
