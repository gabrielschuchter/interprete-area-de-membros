import type { ReactNode } from "react";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { GestaoRestrictedState } from "../restricted-state";

const GestaoAdministrationLayout = async ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const actor = await requireGestaoActor();
  if (actor.role !== "ADMIN") {
    return <GestaoRestrictedState />;
  }
  return children;
};

export default GestaoAdministrationLayout;
