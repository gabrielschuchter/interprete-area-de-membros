import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = createMetadata({
  title: "Privacidade",
  description: "Informações de privacidade da área de membros do Interprete.",
});

const PrivacyPage = () => (
  <LegalPage
    description="Esta Política explica quais dados pessoais o Interprete trata na área de membros, por que e com base em quê, com quem compartilha, por quanto tempo guarda e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD)."
    eyebrow="INTERPRETE · INFORMAÇÕES"
    sections={[
      {
        id: "controlador",
        title: "1. Quem é o controlador",
        body: (
          <>
            <p>
              O Interprete, escola de prática baseada em evidências, é o
              controlador dos dados pessoais tratados na área de membros, nos
              termos do art. 5º, VI, da LGPD. Isso significa que cabe ao
              Interprete decidir como esses dados são tratados.
            </p>
            <p>
              O canal do encarregado pelo tratamento de dados (art. 41 da LGPD)
              e de todos os pedidos relativos a esta Política é{" "}
              <a href="mailto:suporte@interprete.com.br?subject=Privacidade%20e%20dados%20pessoais">
                suporte@interprete.com.br
              </a>
              , com o assunto “Privacidade e dados pessoais”.
            </p>
          </>
        ),
      },
      {
        id: "dados",
        title: "2. Dados que tratamos",
        body: (
          <>
            <p>
              <strong>Dados que você fornece:</strong> nome, e-mail, telefone
              (quando informado), foto, nome de usuário, biografia, área de
              atuação e demais informações do perfil; dados da matrícula e da
              turma; conteúdos que você cria, como publicações, comentários,
              mensagens em grupos, anotações, respostas de exercícios e tarefas,
              metas de estudo e imagens enviadas.
            </p>
            <p>
              <strong>Dados gerados pelo uso:</strong> progresso e tempo nas
              aulas, conclusão de atividades, presença em encontros, favoritos e
              salvos, preferências de notificação, grupos de que participa e
              interações na Comunidade.
            </p>
            <p>
              <strong>Dados técnicos:</strong> endereço IP, tipo de navegador e
              dispositivo, datas e horários de acesso, identificadores de sessão
              e registros de erros e de desempenho.
            </p>
            <p>
              Não solicitamos dados pessoais sensíveis (art. 5º, II). Pedimos
              que você não publique dados de saúde de pacientes: se compartilhar
              um caso, ele deve estar totalmente anonimizado.
            </p>
          </>
        ),
      },
      {
        id: "finalidades",
        title: "3. Finalidades e bases legais",
        body: (
          <>
            <ul>
              <li>
                <strong>
                  Criar e manter sua conta, liberar cursos e turmas, registrar
                  progresso e prestar o serviço contratado:
                </strong>{" "}
                execução de contrato e de procedimentos preliminares (art. 7º,
                V).
              </li>
              <li>
                <strong>Comunidade, perfil e interações entre Membros:</strong>{" "}
                execução de contrato e legítimo interesse (art. 7º, IX), com o
                controle de visibilidade descrito abaixo.
              </li>
              <li>
                <strong>Avisos, notificações da plataforma e suporte:</strong>{" "}
                execução de contrato e legítimo interesse.
              </li>
              <li>
                <strong>
                  Segurança, prevenção a fraudes, registro de acessos e correção
                  de falhas:
                </strong>{" "}
                legítimo interesse e cumprimento de obrigação legal, inclusive a
                guarda de registros de acesso prevista no Marco Civil da
                Internet (Lei 12.965/2014, art. 15).
              </li>
              <li>
                <strong>Melhoria do produto e estatísticas de uso:</strong>{" "}
                legítimo interesse, com dados agregados sempre que possível.
              </li>
              <li>
                <strong>
                  Obrigações legais, regulatórias e exercício regular de
                  direitos:
                </strong>{" "}
                art. 7º, II e VI.
              </li>
              <li>
                <strong>Comunicações opcionais, quando houver:</strong>{" "}
                consentimento (art. 7º, I), que você pode retirar a qualquer
                momento.
              </li>
            </ul>
            <p>
              Não vendemos dados pessoais nem os usamos para decisões
              exclusivamente automatizadas que produzam efeitos jurídicos sobre
              você.
            </p>
          </>
        ),
      },
      {
        id: "visibilidade",
        title: "4. O que outras pessoas veem",
        body: (
          <p>
            Seu nome, foto e publicações ficam visíveis aos Membros que têm
            acesso ao espaço em que você publica, como grupos e Comunidade. Você
            escolhe no perfil se aparece na listagem de membros; o perfil
            continua acessível a quem tem o link. Anotações pessoais, progresso
            e respostas de exercícios não são exibidos a outros alunos. A equipe
            pedagógica e administrativa acessa esses dados para acompanhar o
            estudo, corrigir atividades e dar suporte, sob dever de
            confidencialidade.
          </p>
        ),
      },
      {
        id: "compartilhamento",
        title: "5. Com quem compartilhamos",
        body: (
          <>
            <p>
              Compartilhamos dados apenas na medida necessária com operadores
              que prestam serviços ao Interprete, sob contrato e instruções
              nossas:
            </p>
            <ul>
              <li>autenticação e gestão de contas (Clerk);</li>
              <li>hospedagem e entrega da aplicação (Vercel);</li>
              <li>
                banco de dados e armazenamento de arquivos (Supabase), em
                servidores localizados no Brasil (região de São Paulo);
              </li>
              <li>
                reprodução de vídeo de aulas (YouTube, quando a aula usa esse
                player) e envio de notificações;
              </li>
              <li>monitoramento de erros e desempenho (Sentry).</li>
            </ul>
            <p>
              Também podemos compartilhar dados com autoridades quando houver
              obrigação legal ou ordem judicial, e com assessores jurídicos para
              defesa de direitos. Se um desses prestadores tratar dados fora do
              Brasil, a transferência internacional ocorre com as garantias do
              art. 33 da LGPD, como cláusulas contratuais adequadas.
            </p>
          </>
        ),
      },
      {
        id: "retencao",
        title: "6. Por quanto tempo guardamos",
        body: (
          <>
            <p>
              Mantemos os dados da conta e do estudo enquanto a matrícula e a
              conta estiverem ativas. Depois do encerramento, guardamos o mínimo
              necessário pelo prazo exigido em lei ou para defesa em processos
              (em regra, até 5 anos para dados contratuais e 6 meses para
              registros de acesso, conforme a lei aplicável), e depois
              eliminamos ou anonimizamos.
            </p>
            <p>
              Conteúdos que você ou a equipe apagam na plataforma, como
              publicações, comentários e grupos, deixam de ser exibidos
              imediatamente e são removidos do banco de dados e do armazenamento
              de arquivos. Cópias de segurança são sobrescritas em ciclo
              periódico, e por isso a eliminação completa dessas cópias pode
              levar algum tempo.
            </p>
          </>
        ),
      },
      {
        id: "direitos",
        title: "7. Seus direitos como titular",
        body: (
          <>
            <p>
              Pelo art. 18 da LGPD, você pode, a qualquer momento e mediante
              requisição: confirmar a existência de tratamento; acessar seus
              dados; corrigir dados incompletos, inexatos ou desatualizados;
              pedir anonimização, bloqueio ou eliminação de dados desnecessários
              ou tratados em desconformidade; pedir a portabilidade; obter
              informação sobre com quem compartilhamos; ser informado sobre a
              possibilidade de não consentir e suas consequências; e revogar o
              consentimento.
            </p>
            <p>
              Envie o pedido para{" "}
              <a href="mailto:suporte@interprete.com.br?subject=Privacidade%20e%20dados%20pessoais">
                suporte@interprete.com.br
              </a>{" "}
              usando o e-mail da sua conta, para que possamos confirmar sua
              identidade. Respondemos em até 15 dias, conforme o art. 19, II.
              Você também pode reclamar à Autoridade Nacional de Proteção de
              Dados (ANPD).
            </p>
          </>
        ),
      },
      {
        id: "cookies",
        title: "8. Cookies e tecnologias semelhantes",
        body: (
          <p>
            Usamos cookies e armazenamento local estritamente necessários para
            manter sua sessão, lembrar preferências da interface e proteger a
            conta. Também usamos registros de desempenho e de erros para manter
            a plataforma estável. Não usamos cookies de publicidade. Bloquear os
            cookies essenciais no navegador impede o login.
          </p>
        ),
      },
      {
        id: "seguranca",
        title: "9. Segurança",
        body: (
          <p>
            Adotamos medidas técnicas e administrativas para proteger os dados:
            conexão criptografada (HTTPS), controle de acesso por papel (membro,
            professor, administrador), armazenamento privado de arquivos com
            links temporários, registro de ações administrativas e autenticação
            em duas etapas disponível. Nenhum sistema é totalmente imune; em
            caso de incidente que possa causar risco ou dano relevante,
            comunicaremos você e a ANPD, nos termos do art. 48 da LGPD.
          </p>
        ),
      },
      {
        id: "criancas",
        title: "10. Menores de idade",
        body: (
          <p>
            A plataforma é destinada a profissionais e estudantes maiores de 18
            anos. Se tomarmos conhecimento de cadastro de menor sem a
            autorização legal, excluiremos a conta e os dados associados.
          </p>
        ),
      },
      {
        id: "alteracoes",
        title: "11. Alterações desta Política",
        body: (
          <p>
            Podemos atualizar esta Política para refletir mudanças legais ou no
            serviço. A versão vigente fica nesta página com a data de
            atualização, e mudanças relevantes serão comunicadas dentro da
            plataforma. Veja também os{" "}
            <Link href="/termos-de-uso">Termos de uso</Link>.
          </p>
        ),
      },
    ]}
    title="Privacidade"
    updatedAt="6 de novembro de 2026"
  />
);

export default PrivacyPage;
