import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoPageHeading } from "../gestao-shell";

const GestaoCommunityPage = async () => {
  await requireGestaoAction("community.moderate");
  return (
    <section>
      <GestaoPageHeading
        description="Moderação, grupos, avisos e encontros."
        eyebrow="Gestão · Comunidade"
        title="Comunidade"
      />
      <div className="gestao-empty-state">
        <h2>Publicações e encontros</h2>
        <p>
          Os rascunhos privados permanecem protegidos. As filas de moderação e
          calendário compartilhado serão conectadas nas próximas etapas.
        </p>
      </div>
    </section>
  );
};

export default GestaoCommunityPage;
