import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { InterpreteAuthShell } from "@/components/auth/interprete-auth-shell";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SignInLayoutProps {
  readonly children: ReactNode;
}

const SignInLayout = async ({ children }: SignInLayoutProps) => {
  const { userId, memberDeactivated } = await auth();

  if (memberDeactivated) {
    redirect("/conta-desativada");
  }

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
