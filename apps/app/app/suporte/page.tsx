import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = createMetadata({
  title: "Suporte",
  description: "Encontre ajuda para acessar o Interprete.",
});

const SupportPage = () => (
  <main className="legal-page">
    <p className="legal-page__eyebrow">INTERPRETE · AJUDA</p>
    <h1>Fale com o time</h1>
    <p>
      Se você precisa de ajuda para acessar a plataforma, escreva para
      suporte@interprete.com.br.
    </p>
    <a href="mailto:suporte@interprete.com.br">Enviar e-mail</a>
  </main>
);

export default SupportPage;
