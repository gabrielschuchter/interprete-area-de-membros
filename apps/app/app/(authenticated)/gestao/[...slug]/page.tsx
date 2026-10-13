import { forbidden, notFound } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import {
  canPerformGestaoAction,
  type GestaoAction,
} from "@/lib/gestao-permissions";
import { GestaoPageHeading } from "../gestao-shell";

const areaBySlug: Record<string, { action: GestaoAction; label: string }> = {
  ensino: { action: "content.manage", label: "Ensino" },
  alunos: { action: "students.read", label: "Alunos" },
  comunidade: { action: "community.moderate", label: "Comunidade" },
  administracao: { action: "members.manage", label: "Administração" },
};

const GestaoPendingRoute = async ({
  params,
}: {
  readonly params: Promise<{ readonly slug: string[] }>;
}) => {
  const [{ slug }, actor] = await Promise.all([params, requireGestaoActor()]);
  const area = areaBySlug[slug[0] ?? ""];
  if (!area) {
    notFound();
  }

  if (!canPerformGestaoAction(actor.role, area.action)) {
    forbidden();
  }

  return (
    <section>
      <GestaoPageHeading
        description="A tela ficará disponível quando suas validações, permissões e gravações estiverem prontas."
        eyebrow={`Gestão · ${area.label}`}
        title="Este fluxo está sendo conectado"
      />
      <div className="gestao-empty-state">
        <h2>{area.label}</h2>
        <p>
          Esta rota já usa o shell e a autorização da Gestão. A implementação
          funcional deste fluxo ainda está em andamento.
        </p>
      </div>
    </section>
  );
};

export default GestaoPendingRoute;
