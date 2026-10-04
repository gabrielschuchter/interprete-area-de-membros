"use client";

import {
  TaskChooseOrganization,
  TaskResetPassword,
  TaskSetupMFA,
  useClerk,
  useSession,
} from "@repo/auth/client";
import { AuthLoadingState } from "@repo/auth/components/auth-loading-state";
import { getSignInPath } from "@repo/auth/redirects";
import { useEffect, useState } from "react";
import { InterpreteAuthShell } from "@/components/auth/interprete-auth-shell";

interface SessionTaskContentProperties {
  readonly returnPath: string;
}

const SessionTaskContent = ({ returnPath }: SessionTaskContentProperties) => {
  const { isLoaded, isSignedIn, session } = useSession();
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const currentTask = session?.currentTask?.key;

  useEffect(() => {
    if (isLoaded && isSignedIn && !currentTask) {
      window.location.replace(returnPath);
    }
  }, [currentTask, isLoaded, isSignedIn, returnPath]);

  const handleExitPendingSession = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setSignOutError(false);

    try {
      await signOut({ redirectUrl: getSignInPath(returnPath) });
    } catch {
      setSignOutError(true);
      setIsSigningOut(false);
    }
  };

  let taskContent = (
    <AuthLoadingState loadingLabel="Carregando verificação de segurança…" />
  );

  if (isLoaded && currentTask === "reset-password") {
    taskContent = <TaskResetPassword redirectUrlComplete={returnPath} />;
  } else if (isLoaded && currentTask === "setup-mfa") {
    taskContent = <TaskSetupMFA redirectUrlComplete={returnPath} />;
  } else if (isLoaded && currentTask === "choose-organization") {
    taskContent = <TaskChooseOrganization redirectUrlComplete={returnPath} />;
  } else if (isLoaded && currentTask) {
    taskContent = (
      <div className="interprete-login__error" role="alert">
        <p>
          Esta sessão exige uma etapa de segurança que ainda não está disponível
          nesta conta. Atualize a verificação ou encerre a sessão para entrar
          novamente.
        </p>
        <button
          className="interprete-login__retry"
          disabled={isSigningOut}
          onClick={() => window.location.reload()}
          type="button"
        >
          Tentar carregar novamente
        </button>
        <button
          className="interprete-login__retry"
          disabled={isSigningOut}
          onClick={handleExitPendingSession}
          type="button"
        >
          {isSigningOut ? "Encerrando sessão…" : "Encerrar sessão"}
        </button>
        {signOutError ? (
          <p role="alert">
            Não foi possível encerrar a sessão. Atualize a página ou fale com o
            suporte.
          </p>
        ) : null}
      </div>
    );
  } else if (isLoaded && !isSignedIn) {
    taskContent = (
      <div className="interprete-login__error" role="alert">
        <p>
          Não encontramos uma etapa pendente nesta sessão. Atualize a página ou
          encerre a sessão para entrar novamente.
        </p>
        <button
          className="interprete-login__retry"
          disabled={isSigningOut}
          onClick={() => window.location.reload()}
          type="button"
        >
          Tentar novamente
        </button>
        <button
          className="interprete-login__retry"
          disabled={isSigningOut}
          onClick={handleExitPendingSession}
          type="button"
        >
          {isSigningOut ? "Encerrando sessão…" : "Voltar para entrar"}
        </button>
        {signOutError ? (
          <p role="alert">
            Não foi possível encerrar a sessão. Atualize a página ou fale com o
            suporte.
          </p>
        ) : null}
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

export { SessionTaskContent };
