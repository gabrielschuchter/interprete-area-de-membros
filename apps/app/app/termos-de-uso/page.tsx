import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = createMetadata({
  title: "Termos de uso",
  description: "Termos de uso da área de membros do Interprete.",
});

const TermsPage = () => (
  <LegalPage
    description="Estas condições valem para quem acessa a área de membros do Interprete. Ao entrar na plataforma, você concorda com elas."
    eyebrow="INTERPRETE · INFORMAÇÕES"
    sections={[
      {
        id: "acesso",
        title: "Sua conta e o acesso",
        body: (
          <>
            <p>
              O acesso é pessoal e intransferível. Você é responsável por manter
              sua senha em sigilo e por tudo o que ocorrer na sua conta. Se
              suspeitar de uso indevido, troque a senha e avise o time pelo
              canal de <Link href="/suporte">suporte</Link>.
            </p>
            <p>
              A conta é liberada de acordo com a sua matrícula. Quando a
              matrícula ou o vínculo com uma turma termina, o acesso aos
              conteúdos correspondentes também pode ser encerrado.
            </p>
          </>
        ),
      },
      {
        id: "conteudo",
        title: "Materiais e conteúdos",
        body: (
          <>
            <p>
              Aulas, gravações, textos, exercícios e demais materiais são
              destinados ao estudo individual dos membros. Não é permitido
              copiar, redistribuir, vender, publicar em outros ambientes ou
              compartilhar o acesso a esses materiais sem autorização por
              escrito do Interprete.
            </p>
            <p>
              O conteúdo tem finalidade educacional. Ele não substitui o
              julgamento clínico nem a avaliação individual de cada paciente.
            </p>
          </>
        ),
      },
      {
        id: "comunidade",
        title: "Convivência na Comunidade",
        body: (
          <>
            <p>
              Publicações, comentários e mensagens devem ser respeitosos e
              pertinentes ao estudo. Não é permitido ofender outras pessoas,
              divulgar dados de pacientes ou de terceiros, publicar conteúdo
              ilegal ou fazer propaganda sem relação com a escola.
            </p>
            <p>
              O que você publica continua sendo seu, mas você autoriza o
              Interprete a exibi-lo aos demais membros dentro da plataforma. A
              equipe pode ocultar ou remover conteúdos que desrespeitem estas
              regras.
            </p>
          </>
        ),
      },
      {
        id: "disponibilidade",
        title: "Disponibilidade e mudanças",
        body: (
          <p>
            Trabalhamos para manter a plataforma estável, mas podem ocorrer
            interrupções para manutenção ou por falhas de serviços de terceiros.
            Recursos e conteúdos podem ser atualizados, reorganizados ou
            retirados ao longo do tempo. Quando houver mudança relevante nestes
            termos, avisaremos dentro da plataforma.
          </p>
        ),
      },
      {
        id: "encerramento",
        title: "Suspensão e encerramento",
        body: (
          <p>
            O acesso pode ser suspenso ou encerrado em caso de descumprimento
            destes termos, de uso indevido do conteúdo ou de fim do vínculo com
            a escola. Você também pode pedir o encerramento da sua conta a
            qualquer momento pelo <Link href="/suporte">suporte</Link>.
          </p>
        ),
      },
      {
        id: "dados",
        title: "Dados pessoais",
        body: (
          <p>
            O tratamento dos seus dados está descrito na página de{" "}
            <Link href="/privacidade">Privacidade</Link>.
          </p>
        ),
      },
    ]}
    title="Termos de uso"
    updatedAt="6 de novembro de 2026"
  />
);

export default TermsPage;
