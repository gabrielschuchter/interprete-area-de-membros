import { AuthLoadingState } from "@repo/auth/components/auth-loading-state";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const title = "Entrar";
const description = "Acesse sua área de membros.";
const SignIn = dynamic(
  () => import("@repo/auth/components/sign-in").then((mod) => mod.SignIn),
  {
    loading: () => <AuthLoadingState loadingLabel="Carregando acesso…" />,
  }
);

export const metadata: Metadata = createMetadata({ title, description });

const SignInPage = () => <SignIn />;

export default SignInPage;
