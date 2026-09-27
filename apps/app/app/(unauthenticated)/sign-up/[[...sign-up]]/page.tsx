import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const title = "Criar conta";
const description = "Crie sua conta na área de membros.";
const SignUp = dynamic(
  () => import("@repo/auth/components/sign-up").then((mod) => mod.SignUp),
  {
    loading: () => (
      <div aria-live="polite" className="interprete-login__loading">
        <span aria-hidden="true" />
        Carregando cadastro…
      </div>
    ),
  }
);

export const metadata: Metadata = createMetadata({ title, description });

const SignUpPage = () => <SignUp />;

export default SignUpPage;
