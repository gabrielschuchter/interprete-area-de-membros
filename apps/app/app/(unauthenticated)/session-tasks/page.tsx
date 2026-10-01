"use client";

import { TaskResetPassword, TaskSetupMFA, useSession } from "@repo/auth/client";
import Link from "next/link";
import { useEffect } from "react";
import { InterpreteAuthShell } from "@/components/auth/interprete-auth-shell";

const SessionTaskPage = () => {
  const { isLoaded, isSignedIn, session } = useSession();
  const currentTask = session?.currentTask?.key;

  useEffect(() => {
    if (isLoaded && isSignedIn && !currentTask) {
      window.location.replace("/");
    }
  }, [currentTask, isLoaded, isSignedIn]);

  let taskContent = (
    <div aria-live="polite" className="interprete-login__loading">
      <span aria-hidden="true" />
      Carregando verificação de segurança…
    </div>
  );

  if (isLoaded && currentTask === "reset-password") {
    taskContent = <TaskResetPassword redirectUrlComplete="/" />;
  } else if (isLoaded && currentTask === "setup-mfa") {
    taskContent = <TaskSetupMFA redirectUrlComplete="/" />;
  } else if (isLoaded && currentTask) {
    taskContent = (
      <div className="interprete-login__error" role="alert">
        <p>
          Esta etapa de segurança ainda não está disponível nesta conta. Fale
          com o time para concluir o acesso.
        </p>
        <Link href="/suporte">Falar com o time</Link>
      </div>
    );
  } else if (isLoaded && !currentTask && !isSignedIn) {
    taskContent = (
      <div className="interprete-login__error" role="alert">
        <p>
          Não conseguimos recuperar uma verificação pendente. Entre novamente
          para continuar com segurança.
        </p>
        <Link href="/sign-in">Voltar para entrar</Link>
      </div>
    );
  }

  return (
    <InterpreteAuthShell
      accountActionLabel=""
      accountHref="/"
      accountPrompt=""
      description={
        <>
          Precisamos concluir uma etapa de segurança antes de abrir sua conta.
          <br />
          Seus dados continuam protegidos durante esta verificação.
        </>
      }
      showAccountSwitch={false}
      title="Verificação de segurança"
    >
      {taskContent}
    </InterpreteAuthShell>
  );
};

export default SessionTaskPage;
