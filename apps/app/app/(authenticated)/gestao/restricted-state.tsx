import Link from "next/link";
import { GestaoPageHeading } from "./gestao-shell";

export const GestaoRestrictedState = () => (
  <section>
    <GestaoPageHeading
      description="Esta área contém configurações que só podem ser vistas por administradores."
      eyebrow="Acesso restrito"
      title="Administração"
    />
    <div className="gestao-empty-state">
      <h2>Seu papel não inclui esta área.</h2>
      <p>
        Você ainda pode acompanhar suas turmas, organizar conteúdos e moderar a
        comunidade nas demais áreas da Gestão.
      </p>
      <Link className="gestao-dashboard-link" href="/gestao">
        Voltar à visão geral
      </Link>
    </div>
  </section>
);
