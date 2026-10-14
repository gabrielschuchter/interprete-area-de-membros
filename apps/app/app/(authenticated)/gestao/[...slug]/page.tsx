import { forbidden, notFound, redirect } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import {
  gestaoAdministrationDestination,
  gestaoCommunityDestination,
  gestaoStudentDestination,
} from "@/lib/gestao-navigation";
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

const GestaoPendingRoute = async ({
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

  if (slug[0] === "comunidade") {
    const destination = gestaoCommunityDestination(slug.slice(1));
    if (destination) {
      redirect(destination);
    }
  }

  if (slug[0] === "administracao" && slug.length > 1) {
    const destination = gestaoAdministrationDestination(slug.slice(1));
    if (destination) {
      redirect(destination);
    }
    notFound();
  }

  if (slug[0] === "alunos") {
    const destination = gestaoStudentDestination(slug.slice(1));
    if (destination) {
      redirect(destination);
    }
  }

  notFound();
};

export default GestaoPendingRoute;
