import { forbidden, notFound } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import {
  canPerformGestaoAction,
  type GestaoAction,
} from "@/lib/gestao-permissions";

const actionByArea: Record<string, GestaoAction> = {
  ensino: "content.manage",
  alunos: "students.read",
  comunidade: "community.moderate",
  administracao: "members.manage",
};

/** Endereço que não existe na Gestão: nada de telas antigas como destino. */
const GestaoUnknownRoute = async ({
  params,
}: {
  readonly params: Promise<{ readonly slug: string[] }>;
}) => {
  const [{ slug }, actor] = await Promise.all([params, requireGestaoActor()]);
  const action = actionByArea[slug[0] ?? ""];
  if (!action) {
    notFound();
  }
  if (!canPerformGestaoAction(actor.role, action)) {
    forbidden();
  }
  notFound();
};

export default GestaoUnknownRoute;
