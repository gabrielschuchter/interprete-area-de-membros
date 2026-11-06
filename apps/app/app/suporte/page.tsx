import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = createMetadata({
  title: "Suporte",
  description: "Encontre ajuda para acessar o Interprete.",
});

const SupportPage = () => (
  <LegalPage
    description="Se algo não funcionar ou você não conseguir entrar, escreva para o time. Quanto mais detalhes, mais rápido conseguimos ajudar."
    eyebrow="INTERPRETE · AJUDA"
    sections={[
      {
        id: "contato",
        title: "Fale com o time",
        body: (
          <>
            <p>
              Envie um e-mail para{" "}
              <a href="mailto:suporte@interprete.com.br">
                suporte@interprete.com.br
              </a>
              . Respondemos em dias úteis.
            </p>
            <a
              className="legal-page__action"
              href="mailto:suporte@interprete.com.br?subject=Ajuda%20com%20o%20acesso"
            >
              Enviar e-mail
            </a>
          </>
        ),
      },
      {
        id: "acesso",
        title: "Problemas para entrar",
        body: (
          <ul>
            <li>
              Esqueceu a senha? Na tela de entrada, informe seu e-mail e use
              “Esqueci minha senha”. Enviaremos um código de recuperação.
            </li>
            <li>
              Não recebeu o código? Confira a caixa de spam e confirme que o
              e-mail é o mesmo da sua matrícula.
            </li>
            <li>
              Ainda não tem conta? Use “Criar conta” com o e-mail da sua
              matrícula. Se o acesso não for liberado, escreva para o time.
            </li>
            <li>
              Conta desativada ou matrícula encerrada: o time pode confirmar a
              situação e orientar os próximos passos.
            </li>
          </ul>
        ),
      },
      {
        id: "informar",
        title: "O que incluir na mensagem",
        body: (
          <ul>
            <li>O e-mail que você usa para entrar (nunca envie sua senha).</li>
            <li>O que você tentou fazer e o que apareceu na tela.</li>
            <li>Dispositivo e navegador, com um print, se possível.</li>
          </ul>
        ),
      },
      {
        id: "privacidade",
        title: "Pedidos sobre seus dados",
        body: (
          <p>
            Para acessar, corrigir ou excluir seus dados, use o mesmo e-mail e
            indique o pedido no assunto da mensagem.
          </p>
        ),
      },
    ]}
    title="Fale com o time"
  />
);

export default SupportPage;
