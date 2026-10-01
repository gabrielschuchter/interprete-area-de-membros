import { auth } from "@repo/auth/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { InterpreteAuthShell } from "@/components/auth/interprete-auth-shell";

export const dynamic = "force-dynamic";

interface SignInLayoutProps {
  readonly children: ReactNode;
}

const SignInLayout = async ({ children }: SignInLayoutProps) => {
  const { userId } = await auth();

  if (userId) {
    redirect("/");
  }

  return (
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
};

export default SignInLayout;
