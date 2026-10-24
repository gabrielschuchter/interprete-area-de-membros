import Link from "next/link";
import { getGestaoYouTubeIntegration } from "@/lib/gestao-integrations";
import { GestaoPageHeading } from "../../gestao-shell";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const modeCopy = {
  "api-key": {
    tone: "ok",
    label: "Conectado por chave de API",
    detail:
      "A plataforma consulta o YouTube com uma chave guardada no servidor. A chave nunca aparece nesta tela.",
  },
  development: {
    tone: "warn",
    label: "Adaptador de desenvolvimento",
    detail: "Respostas simuladas. Só existe em ambiente de desenvolvimento.",
  },
  none: {
    tone: "danger",
    label: "Sem chave configurada",
    detail:
      "Sem a chave de API, vídeos do YouTube não podem ser verificados antes de publicar a aula.",
  },
} as const;

const GestaoIntegrationsPage = async () => {
  const data = await getGestaoYouTubeIntegration();
  const mode = modeCopy[data.mode];
  return (
    <section className="gx-page">
      <GestaoPageHeading
        description="Situação do YouTube na plataforma. A conexão é feita por chave de API no servidor; troca ou remoção da chave é uma configuração de ambiente."
        eyebrow="Gestão · Administração"
        title="Integrações"
      />
      <div className="gx-card gx-card-padded">
        <h2>YouTube</h2>
        <p>
          <span className="gx-chip" data-tone={mode.tone}>
            {mode.label}
          </span>
        </p>
        <p>{mode.detail}</p>
        <dl className="gx-facts">
          <div className="gx-fact">
            <dt>Vídeos do YouTube em aulas</dt>
            <dd>{data.total}</dd>
          </div>
          <div className="gx-fact">
            <dt>Ainda não verificados</dt>
            <dd>{data.unchecked}</dd>
          </div>
          <div className="gx-fact">
            <dt>Última verificação</dt>
            <dd>
              {data.lastCheckedAt
                ? dateFormat.format(data.lastCheckedAt)
                : "Nunca"}
            </dd>
          </div>
        </dl>
        {data.byStatus.length ? (
          <ul className="gx-list">
            {data.byStatus.map((row) => (
              <li key={row.status ?? "none"}>
                <div>
                  <span className="gx-plain">{row.label}</span>
                  <strong>{row.count}</strong>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="gx-card gx-card-padded">
        <h2>Vídeos indisponíveis</h2>
        {data.problems.length === 0 ? (
          <p>Nenhum vídeo com problema na última verificação.</p>
        ) : (
          <ul className="gx-list">
            {data.problems.map((asset) => (
              <li key={asset.id}>
                <Link href={`/gestao/ensino/cursos/${asset.course.id}`}>
                  <span className="gx-inline">
                    <strong>{asset.lesson}</strong> · {asset.course.title}
                  </span>
                  <span className="gx-chip" data-tone="danger">
                    {asset.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default GestaoIntegrationsPage;
