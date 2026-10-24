import "./gestao.css";
import "./gestao-areas.css";
import "./gestao-fonts.css";
import "./gestao-kit.css";
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
      localQaAuth={
        process.env.NODE_ENV === "development" &&
        process.env.GESTAO_DEV_AUTH === "true"
      }
      memberId={actor.userId}
      role={actor.role}
    >
      {children}
    </GestaoShell>
  );
};

export default GestaoLayout;
