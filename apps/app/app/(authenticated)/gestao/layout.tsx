import "./gestao.css";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { GestaoShell } from "./gestao-shell";

export const dynamic = "force-dynamic";

const GestaoLayout = async ({ children }: { readonly children: ReactNode }) => {
  if (env.GESTAO_V2_ENABLED !== "true") {
    notFound();
  }

  const actor = await requireGestaoActor();
  return (
    <GestaoShell
      avatarUrl={actor.avatarUrl}
      displayName={actor.displayName ?? "Interprete"}
      email={actor.email}
      memberId={actor.userId}
      role={actor.role}
    >
      {children}
    </GestaoShell>
  );
};

export default GestaoLayout;
