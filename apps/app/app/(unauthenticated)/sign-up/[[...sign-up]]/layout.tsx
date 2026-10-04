import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { InterpreteAuthShell } from "@/components/auth/interprete-auth-shell";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SignUpLayoutProps {
  readonly children: ReactNode;
}

const SignUpLayout = async ({ children }: SignUpLayoutProps) => {
  const { userId, memberDeactivated } = await auth();

  if (memberDeactivated) {
    redirect("/conta-desativada");
  }

  if (userId) {
    redirect("/");
  }

  return (
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
};

export default SignUpLayout;
