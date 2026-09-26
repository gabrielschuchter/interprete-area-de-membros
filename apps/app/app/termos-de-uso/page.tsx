import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = createMetadata({
  title: "Termos de uso",
  description: "Termos de uso da área de membros do Interprete.",
});

const TermsPage = () => (
  <main className="legal-page">
    <p className="legal-page__eyebrow">INTERPRETE · INFORMAÇÕES</p>
    <h1>Termos de uso</h1>
    <p>
      Esta página reúne as condições de uso da área de membros do Interprete. O
      acesso à plataforma pressupõe o uso individual da conta e o respeito aos
      materiais e às discussões disponibilizados no ambiente de estudo.
    </p>
    <a href="/sign-in">Voltar para entrar</a>
  </main>
);

export default TermsPage;
