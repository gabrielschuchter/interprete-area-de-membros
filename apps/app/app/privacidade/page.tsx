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
    description="Como o Interprete usa os dados necessários para autenticar sua conta, oferecer o ambiente de estudo e manter suas interações sob as permissões da plataforma."
    eyebrow="INTERPRETE · INFORMAÇÕES"
    sections={[
      {
        id: "dados-coletados",
        title: "Dados que tratamos",
        body: (
          <>
            <p>
              Dados de conta: nome, e-mail, telefone (quando informado) e foto
              de perfil. Dados de uso: progresso nas aulas, anotações, tarefas,
              respostas, presença em encontros e interações na Comunidade, como
              publicações, comentários e participação em grupos.
            </p>
            <p>
              Dados técnicos, como tipo de navegador e registros de erro, são
              coletados para manter a segurança e o bom funcionamento do
              serviço.
            </p>
          </>
        ),
      },
      {
        id: "finalidades",
        title: "Para que usamos",
        body: (
          <p>
            Autenticar o acesso, liberar os cursos e turmas da sua matrícula,
            registrar seu progresso, permitir que você participe da Comunidade,
            enviar avisos e notificações da plataforma, dar suporte e corrigir
            falhas. Não vendemos seus dados.
          </p>
        ),
      },
      {
        id: "visibilidade",
        title: "O que os outros membros veem",
        body: (
          <p>
            Seu nome, foto e publicações na Comunidade ficam visíveis conforme o
            grupo em que você participa. No perfil, você escolhe se aparece na
            listagem de membros. Anotações pessoais, progresso e respostas de
            exercícios não são exibidos a outros alunos; a equipe pedagógica
            pode acessá-los para acompanhar o seu estudo.
          </p>
        ),
      },
      {
        id: "compartilhamento",
        title: "Com quem compartilhamos",
        body: (
          <p>
            Usamos prestadores de serviço para autenticação, hospedagem, banco
            de dados, armazenamento de arquivos, vídeo e monitoramento de erros.
            Eles tratam os dados apenas para prestar esses serviços ao
            Interprete. Também podemos compartilhar dados quando a lei exigir.
          </p>
        ),
      },
      {
        id: "seus-direitos",
        title: "Seus direitos",
        body: (
          <p>
            Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você
            pode pedir confirmação do tratamento, acesso, correção,
            portabilidade e eliminação dos seus dados, além de informações sobre
            compartilhamento. Para isso, fale com o time pelo{" "}
            <Link href="/suporte">suporte</Link>.
          </p>
        ),
      },
      {
        id: "retencao",
        title: "Por quanto tempo guardamos",
        body: (
          <p>
            Mantemos os dados enquanto a conta estiver ativa e pelo tempo
            necessário para cumprir obrigações legais ou resolver pendências.
            Conteúdos apagados na plataforma deixam de ser exibidos e são
            removidos do armazenamento.
          </p>
        ),
      },
      {
        id: "seguranca",
        title: "Segurança",
        body: (
          <p>
            Aplicamos controles de acesso, conexão criptografada e separação de
            permissões por papel. Nenhum sistema é totalmente imune a falhas; se
            identificarmos um incidente que afete seus dados, avisaremos você.
          </p>
        ),
      },
    ]}
    title="Privacidade"
    updatedAt="6 de novembro de 2026"
  />
);

export default PrivacyPage;
