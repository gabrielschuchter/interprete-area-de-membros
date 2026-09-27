import type { ReactNode } from "react";
import { InterpreteAuthShell } from "@/components/auth/interprete-auth-shell";

interface SignUpLayoutProps {
  readonly children: ReactNode;
}

const SignUpLayout = ({ children }: SignUpLayoutProps) => (
  <InterpreteAuthShell
    accountActionLabel="Entrar"
    accountHref="/sign-in"
    accountPrompt="Já tem uma conta?"
    description={
      <>
        Crie seu acesso à Interprete.
        <br />
        Vamos preparar seu espaço de aprendizagem.
      </>
    }
    title="Criar conta"
  >
    {children}
  </InterpreteAuthShell>
);

export default SignUpLayout;
