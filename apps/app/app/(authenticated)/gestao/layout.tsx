import "./gestao.css";
import "./gestao-areas.css";
import "./gestao-fonts.css";
import "./gestao-kit.css";
import { database } from "@repo/database";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { decodePreviewToken, previewCookieName } from "@/lib/preview-session";
import { GestaoShell } from "./gestao-shell";

export const dynamic = "force-dynamic";

const GestaoLayout = async ({ children }: { readonly children: ReactNode }) => {
  if (env.GESTAO_V2_ENABLED !== "true") {
    notFound();
  }

  const actor = await requireGestaoActor();
  const preview = decodePreviewToken(
    (await cookies()).get(previewCookieName)?.value
  );
  const seen = await database.member.findUnique({
    where: { id: actor.userId },
    select: { gestaoWelcomeSeenAt: true },
  });
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
      welcomeSeen={Boolean(seen?.gestaoWelcomeSeenAt)}
    >
      {preview ? (
        <output className="gk-preview-note">
          Prévia ativa como {preview.label}.{" "}
          <a href="/gestao/previa/sair">Sair da prévia</a>
        </output>
      ) : null}
      {children}
    </GestaoShell>
  );
};

export default GestaoLayout;
