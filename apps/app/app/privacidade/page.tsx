import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = createMetadata({
  title: "Privacidade",
  description: "Informações de privacidade da área de membros do Interprete.",
});

const PrivacyPage = () => (
  <main className="legal-page">
    <p className="legal-page__eyebrow">INTERPRETE · INFORMAÇÕES</p>
    <h1>Privacidade</h1>
    <p>
      O Interprete utiliza os dados necessários para autenticar sua conta,
      oferecer o ambiente de aprendizagem e manter suas interações privadas
      conforme as permissões da plataforma.
    </p>
    <a href="/sign-in">Voltar para entrar</a>
  </main>
);

export default PrivacyPage;
