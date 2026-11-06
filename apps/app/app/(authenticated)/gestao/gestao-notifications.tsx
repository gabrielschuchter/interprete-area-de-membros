"use client";

import { MemberHeaderControls } from "../components/member-header-controls";

/**
 * O sino da Gestão é o mesmo da plataforma (painel, balão, contagem, tempo
 * real e histórico), sem modelo próprio.
 */
export const GestaoNotificationsBell = ({
  memberId,
}: {
  readonly memberId: string;
}) => (
  <MemberHeaderControls
    memberId={memberId}
    showSaved={false}
    showSearch={false}
  />
);
