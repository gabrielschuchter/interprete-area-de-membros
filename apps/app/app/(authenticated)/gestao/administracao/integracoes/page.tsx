import { database } from "@repo/database";
import Link from "next/link";
import { getGestaoYouTubeIntegration } from "@/lib/gestao-integrations";
import { getYouTubePolicy } from "@/lib/integrations-settings";
import { GestaoIcon } from "../../gestao-icon";
import { YouTubeSettings } from "./youtube-settings";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

const modeCopy = {
  "api-key": {
    chip: "Ativo",
    detail:
      "A plataforma consulta o YouTube com uma chave guardada no servidor, só para ler dados dos vídeos. A chave nunca aparece nesta tela.",
    title: "Conectado por chave de API",
    tone: "active",
  },
  development: {
    chip: "Desenvolvimento",
    detail: "Respostas simuladas. Só existe em ambiente de desenvolvimento.",
    title: "Adaptador de desenvolvimento",
    tone: "warn",
  },
  none: {
    chip: "Sem chave",
    detail:
      "Sem a chave de API, vídeos do YouTube não podem ser verificados antes de publicar a aula. A chave é configurada no ambiente do servidor.",
    title: "Chave de API não configurada",
    tone: "danger",
  },
} as const;

const GestaoIntegrationsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  const [data, policy, groups] = await Promise.all([
    getGestaoYouTubeIntegration(),
    getYouTubePolicy(),
    database.importedRecordingGroup.count(),
  ]);
  const mode = modeCopy[data.mode];
  return (
    <section className="gt-page">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Integrações</h1>
          <p>Serviços conectados à plataforma e as regras de uso de cada um.</p>
        </div>
      </header>
      {params.resultado === "salvo" ? (
        <output className="gk-result">Regras do YouTube salvas.</output>
      ) : null}

      <div className="gk-int-stack">
        <article className="gk-card gk-int-card">
          <header className="gk-int-head">
            <span aria-hidden="true" className="gk-kindtile">
              <GestaoIcon name="video" size={20} />
            </span>
            <div>
              <h2>YouTube</h2>
              <p>
                Aulas e gravações hospedadas no YouTube como vídeos não
                listados.
              </p>
            </div>
            <span className="gk-chip" data-tone={mode.tone}>
              {mode.chip}
            </span>
          </header>

          <div className="gk-int-conn">
            <GestaoIcon
              name={data.mode === "none" ? "alert-circle" : "check-circle"}
              size={20}
            />
            <div>
              <strong>{mode.title}</strong>
              <span>{mode.detail}</span>
            </div>
          </div>
          <p className="gk-hint">
            Conectar o canal por login do Google (para ver quem é o dono dos
            vídeos e trocar de canal) ainda não está ligado. O caminho já
            existe: quando as credenciais do aplicativo Google forem fornecidas,
            esta área ganha “Conectar canal”, “Trocar canal” e “Desconectar”.
          </p>

          <YouTubeSettings initial={policy} />

          <dl className="gk-int-facts">
            <div>
              <dt>Vídeos do YouTube em aulas</dt>
              <dd>{data.total}</dd>
            </div>
            <div>
              <dt>Ainda não verificados</dt>
              <dd>{data.unchecked}</dd>
            </div>
            <div>
              <dt>Última verificação</dt>
              <dd>
                {data.lastCheckedAt
                  ? dateFormat.format(data.lastCheckedAt)
                  : "Nunca"}
              </dd>
            </div>
          </dl>

          <h3 className="gk-card-title">Vídeos indisponíveis</h3>
          {data.problems.length === 0 ? (
            <p className="gk-hint">
              Nenhum vídeo com problema na última verificação.
            </p>
          ) : (
            <ul className="gk-history">
              {data.problems.map((asset) => (
                <li key={asset.id}>
                  <Link
                    href={`/gestao/ensino/cursos/${asset.course.id}`}
                    prefetch={false}
                  >
                    <strong>{asset.lesson}</strong> · {asset.course.title}
                  </Link>{" "}
                  <span className="gk-chip" data-tone="danger">
                    {asset.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="gk-card gk-int-card">
          <header className="gk-int-head">
            <span aria-hidden="true" className="gk-kindtile">
              <GestaoIcon name="archive" size={20} />
            </span>
            <div>
              <h2>Kiwify</h2>
              <p>
                Origem das gravações históricas importadas. Somente leitura.
              </p>
            </div>
            <span
              className="gk-chip"
              data-tone={groups > 0 ? "active" : "muted"}
            >
              {groups > 0 ? "Ativo" : "Sem importação"}
            </span>
          </header>
          <p className="gk-hint">
            {groups} grupos preservados.{" "}
            <Link
              href="/gestao/administracao/gravacoes-historicas"
              prefetch={false}
            >
              Abrir gravações históricas
            </Link>
          </p>
        </article>
      </div>
    </section>
  );
};

export default GestaoIntegrationsPage;
