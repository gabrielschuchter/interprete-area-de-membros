import { randomUUID } from "node:crypto";
import type { ReactNode } from "react";
import { startDraft } from "@/app/(authenticated)/comunidade/actions";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";

interface CommunityDraftStarterProperties {
  readonly children: ReactNode;
  readonly className?: string;
  readonly pendingLabel?: ReactNode;
  readonly spaceId?: string;
  readonly variant?: "default" | "ghost" | "outline";
}

export const CommunityDraftStarter = ({
  children,
  className,
  pendingLabel = "Abrindo editor…",
  spaceId,
  variant = "default",
}: CommunityDraftStarterProperties) => (
  <SingleFlightForm action={startDraft}>
    <input name="idempotencyKey" type="hidden" value={randomUUID()} />
    <input name="spaceId" type="hidden" value={spaceId ?? ""} />
    <SingleFlightSubmit
      className={className}
      pendingLabel={pendingLabel}
      variant={variant}
    >
      {children}
    </SingleFlightSubmit>
  </SingleFlightForm>
);
