import type { ReactNode } from "react";
import { InterpreteAuthShell } from "@/components/auth/interprete-auth-shell";

interface SignInLayoutProps {
  readonly children: ReactNode;
}

const SignInLayout = ({ children }: SignInLayoutProps) => (
  <InterpreteAuthShell
    accountActionLabel="Criar conta"
    accountHref="/sign-up"
    accountPrompt="Ainda não tem uma conta?"
    description={
      <>
        Bem-vindo de volta à Interprete.
        <br />
        Acesse sua conta para continuar sua jornada.
      </>
    }
    title="Entrar"
  >
    {children}
  </InterpreteAuthShell>
);

export default SignInLayout;
