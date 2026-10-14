import Link from "next/link";
import { requireGestaoAdmin } from "@/lib/gestao-authorization";
import { GestaoPageHeading } from "../gestao-shell";

const adminAreas = [
  ["Membros e papéis", "/gestao/administracao/membros"],
  ["Acessos", "/gestao/administracao/acessos"],
  ["Gravações históricas", "/gestao/administracao/gravacoes-historicas"],
  ["Personalização", "/gestao/administracao/personalizacao"],
  ["Medalhas", "/gestao/administracao/medalhas"],
] as const;

const GestaoAdministrationPage = async () => {
  await requireGestaoAdmin();
  return (
    <section>
      <GestaoPageHeading
        description="Papéis, acessos, integrações e histórico da Gestão."
        eyebrow="Gestão · Configurações restritas"
        title="Administração"
      />
      <div className="gestao-empty-state">
        <h2>Configurações da Gestão</h2>
        <p>Área exclusiva para administradores.</p>
        <nav aria-label="Configurações administrativas">
          {adminAreas.map(([label, href]) => (
            <p key={href}>
              <Link className="gestao-dashboard-link" href={href}>
                {label}
              </Link>
            </p>
          ))}
        </nav>
      </div>
    </section>
  );
};

export default GestaoAdministrationPage;
