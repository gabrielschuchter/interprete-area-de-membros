import type { Metadata } from "next";
import { redirect } from "next/navigation";

const LegacyMyPublicationsPage = () => {
  redirect("/comunidade/minhas-publicacoes");
};

export default LegacyMyPublicationsPage;

export const metadata: Metadata = { title: "Meus tópicos | Interprete" };
