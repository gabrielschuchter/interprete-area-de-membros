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
    description="Contrato entre o Interprete e as pessoas que acessam a área de membros. Leia com atenção: ao criar a conta ou entrar na plataforma, você declara que leu e concorda com estas condições."
    eyebrow="INTERPRETE · INFORMAÇÕES"
    sections={[
      {
        id: "definicoes",
        title: "1. Definições e aceite",
        body: (
          <>
            <p>
              Nestes Termos, “Interprete” é a escola de prática baseada em
              evidências responsável pela área de membros; “Plataforma” é o
              ambiente digital em que ficam cursos, aulas, gravações, encontros,
              tarefas, biblioteca e Comunidade; e “Membro” é a pessoa natural
              com conta ativa, vinculada a uma matrícula.
            </p>
            <p>
              O cadastro e o uso da Plataforma implicam aceite integral destes
              Termos e da{" "}
              <Link href="/privacidade">Política de Privacidade</Link>. Quem não
              concordar deve deixar de usar a Plataforma. O Membro declara ter
              capacidade civil para contratar e fornecer dados verdadeiros,
              completos e atualizados.
            </p>
          </>
        ),
      },
      {
        id: "objeto",
        title: "2. Objeto e natureza do serviço",
        body: (
          <>
            <p>
              A Plataforma oferece, durante o período da matrícula, acesso a
              conteúdos educacionais e a recursos de estudo e convivência entre
              Membros. O serviço tem finalidade exclusivamente educacional e
              informativa.
            </p>
            <p>
              O conteúdo não constitui aconselhamento médico, nutricional,
              psicológico, jurídico ou de qualquer outra profissão regulamentada
              e não substitui o julgamento profissional nem a avaliação
              individual de cada paciente ou caso. A responsabilidade pelas
              decisões clínicas tomadas a partir do material é integralmente do
              profissional que as toma.
            </p>
          </>
        ),
      },
      {
        id: "conta",
        title: "3. Conta, acesso e segurança",
        body: (
          <>
            <p>
              A conta é pessoal e intransferível. É vedado compartilhar login e
              senha, permitir o uso por terceiros ou manter acessos simultâneos
              com o fim de repassar o conteúdo. O Membro responde por toda
              atividade realizada com suas credenciais, salvo se comunicar
              imediatamente ao <Link href="/suporte">suporte</Link> a perda, o
              furto ou o uso indevido.
            </p>
            <p>
              O acesso aos conteúdos depende da matrícula e da turma do Membro,
              e pode ser limitado por prazo, módulo ou data de liberação. O
              Interprete pode adotar medidas de segurança, como verificação em
              duas etapas, bloqueio preventivo e registro de acessos, para
              proteger a Plataforma e os Membros.
            </p>
          </>
        ),
      },
      {
        id: "propriedade-intelectual",
        title: "4. Propriedade intelectual e licença de uso",
        body: (
          <>
            <p>
              Aulas, gravações, textos, slides, exercícios, bases, marcas,
              logotipos, identidade visual e software da Plataforma são
              protegidos pela Lei 9.610/1998 (direitos autorais), pela Lei
              9.279/1996 (propriedade industrial) e pela Lei 9.609/1998
              (programas de computador), e pertencem ao Interprete ou a seus
              licenciantes e autores.
            </p>
            <p>
              O Interprete concede ao Membro licença pessoal, não exclusiva,
              intransferível e revogável para acessar e estudar o conteúdo
              durante a matrícula. Sem autorização prévia e escrita, é proibido
              reproduzir, gravar, baixar por meios não oferecidos pela
              Plataforma, redistribuir, revender, publicar em outros ambientes,
              usar para treinar sistemas de inteligência artificial, fazer
              engenharia reversa ou contornar medidas técnicas de proteção.
            </p>
          </>
        ),
      },
      {
        id: "conteudo-membro",
        title: "5. Conteúdo publicado pelo Membro",
        body: (
          <>
            <p>
              Publicações, comentários, anotações compartilhadas, imagens e
              demais conteúdos enviados pelo Membro permanecem de sua
              titularidade. Ao publicá-los em espaços visíveis a outras pessoas,
              o Membro concede ao Interprete licença gratuita, não exclusiva e
              limitada à Plataforma para hospedar, exibir, reproduzir e adaptar
              tecnicamente esse conteúdo (por exemplo, redimensionar imagens),
              pelo tempo em que ele permanecer publicado.
            </p>
            <p>
              O Membro declara ser titular ou ter autorização para o que publica
              e responde pelo conteúdo, inclusive perante terceiros. Ao
              compartilhar casos clínicos, deve anonimizar completamente o
              paciente, sem dados que permitam identificá-lo direta ou
              indiretamente, e respeitar o sigilo profissional e as normas do
              seu conselho de classe.
            </p>
          </>
        ),
      },
      {
        id: "conduta",
        title: "6. Regras de conduta",
        body: (
          <>
            <p>É proibido na Plataforma:</p>
            <ul>
              <li>
                ofender, discriminar, assediar, ameaçar ou expor pessoas, em
                especial por origem, raça, gênero, orientação sexual, religião,
                deficiência ou corpo;
              </li>
              <li>
                divulgar dados pessoais ou de saúde de pacientes ou de terceiros
                sem anonimização;
              </li>
              <li>
                publicar conteúdo ilícito, fraudulento, malicioso ou que viole
                direitos de terceiros;
              </li>
              <li>
                fazer propaganda, venda, captação de clientes ou spam sem
                autorização;
              </li>
              <li>
                tentar acessar contas, áreas ou dados sem permissão, testar
                vulnerabilidades, automatizar acessos em massa ou sobrecarregar
                o serviço;
              </li>
              <li>
                se passar por outra pessoa ou fornecer informações falsas no
                cadastro.
              </li>
            </ul>
            <p>
              A equipe pode ocultar ou remover conteúdos que violem estas
              regras, aplicar advertência, suspender recursos de interação ou
              encerrar a conta, conforme a gravidade e a reincidência.
            </p>
          </>
        ),
      },
      {
        id: "remocao-conteudo",
        title: "7. Moderação, denúncias e remoção",
        body: (
          <p>
            Conteúdos que pareçam violar estes Termos ou a lei podem ser
            denunciados à equipe pelos recursos da Comunidade ou pelo{" "}
            <Link href="/suporte">suporte</Link>. A remoção de conteúdo pela
            equipe pode ocorrer sem aviso prévio quando houver risco a pessoas,
            ilegalidade evidente ou ordem judicial. Conteúdos excluídos pelo
            autor ou pela equipe deixam de ser exibidos e são removidos dos
            sistemas conforme o prazo descrito na Política de Privacidade,
            ressalvadas cópias de segurança temporárias e obrigações legais de
            guarda.
          </p>
        ),
      },
      {
        id: "disponibilidade",
        title: "8. Disponibilidade e alterações do serviço",
        body: (
          <p>
            O Interprete empenha-se para manter a Plataforma disponível e
            segura, mas não garante funcionamento ininterrupto ou livre de
            erros. Podem ocorrer interrupções para manutenção, atualização ou
            por falhas de fornecedores de internet, hospedagem, vídeo e
            autenticação. Recursos, conteúdos e a organização da Plataforma
            podem ser atualizados, substituídos ou retirados, preservando-se o
            que foi contratado na matrícula.
          </p>
        ),
      },
      {
        id: "responsabilidade",
        title: "9. Limitação de responsabilidade",
        body: (
          <>
            <p>
              Na extensão permitida pela lei, o Interprete não responde por
              danos decorrentes de uso indevido da conta pelo Membro, de
              conteúdos publicados por outros Membros, de indisponibilidade
              causada por terceiros ou por caso fortuito e força maior, nem por
              decisões profissionais tomadas com base no material.
            </p>
            <p>
              Nada nestes Termos afasta direitos assegurados ao consumidor pelo
              Código de Defesa do Consumidor (Lei 8.078/1990) nem
              responsabilidades que a lei não permita limitar.
            </p>
          </>
        ),
      },
      {
        id: "suspensao",
        title: "10. Suspensão, encerramento e cancelamento",
        body: (
          <>
            <p>
              O Interprete pode suspender ou encerrar o acesso em caso de
              violação destes Termos, fraude, determinação legal ou fim do
              vínculo contratual. Sempre que possível, o Membro será informado
              do motivo e poderá se manifestar pelo{" "}
              <Link href="/suporte">suporte</Link>.
            </p>
            <p>
              O Membro pode pedir o encerramento da conta a qualquer momento.
              Condições de pagamento, prazo de arrependimento, cancelamento e
              reembolso da matrícula seguem o contrato de matrícula e o Código
              de Defesa do Consumidor, inclusive o direito de arrependimento em
              até 7 dias para contratações feitas fora do estabelecimento
              comercial (art. 49).
            </p>
          </>
        ),
      },
      {
        id: "privacidade",
        title: "11. Proteção de dados pessoais",
        body: (
          <p>
            O tratamento de dados pessoais segue a Lei Geral de Proteção de
            Dados (Lei 13.709/2018) e está descrito na{" "}
            <Link href="/privacidade">Política de Privacidade</Link>, que faz
            parte destes Termos.
          </p>
        ),
      },
      {
        id: "alteracoes",
        title: "12. Alterações destes Termos",
        body: (
          <p>
            Os Termos podem ser atualizados para refletir mudanças legais ou no
            serviço. A versão vigente fica sempre nesta página, com a data de
            atualização. Mudanças relevantes serão comunicadas na Plataforma ou
            por e-mail, e o uso continuado após a comunicação indica
            concordância com a nova versão.
          </p>
        ),
      },
      {
        id: "lei-foro",
        title: "13. Lei aplicável, foro e contato",
        body: (
          <>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do
              Brasil. Fica eleito o foro do domicílio do Membro para dirimir
              controvérsias decorrentes de relação de consumo e, nos demais
              casos, o foro da comarca da sede do Interprete, com renúncia a
              qualquer outro.
            </p>
            <p>
              Dúvidas, reclamações e pedidos podem ser enviados para{" "}
              <a href="mailto:suporte@interprete.com.br">
                suporte@interprete.com.br
              </a>
              .
            </p>
          </>
        ),
      },
    ]}
    title="Termos de uso"
    updatedAt="6 de novembro de 2026"
  />
);

export default TermsPage;
