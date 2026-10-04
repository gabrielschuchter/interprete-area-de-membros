"use client";

import { useClerk } from "@repo/auth/client";
import { Button } from "@repo/design-system/components/ui/button";
import { LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";

export const ManageAccountButton = () => {
  const { openUserProfile } = useClerk();

  return (
    <Button onClick={() => openUserProfile()} type="button" variant="outline">
      <ShieldCheckIcon aria-hidden="true" />
      Gerenciar conta e segurança
    </Button>
  );
};

export const SignOutButton = () => {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setSignOutFailed(false);

    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      setSignOutFailed(true);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={isSigningOut}
        onClick={handleSignOut}
        type="button"
        variant="ghost"
      >
        <LogOutIcon aria-hidden="true" />
        {isSigningOut ? "Saindo..." : "Sair da conta"}
      </Button>
      {signOutFailed ? (
        <p
          aria-live="assertive"
          className="text-destructive text-sm"
          role="alert"
        >
          Não foi possível encerrar a sessão. Verifique sua conexão e tente
          novamente.
        </p>
      ) : null}
    </div>
  );
};
