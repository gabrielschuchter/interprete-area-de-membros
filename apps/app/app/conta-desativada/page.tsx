import { SignOutButton } from "@/app/(authenticated)/configuracoes/account-actions";

const DeactivatedAccountPage = () => (
  <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
    <div className="space-y-2">
      <p className="font-medium text-muted-foreground text-sm">Interprete</p>
      <h1 className="font-semibold font-serif text-3xl text-foreground">
        Esta conta foi desativada
      </h1>
      <p className="text-muted-foreground">
        O acesso foi encerrado. Saia desta sessão para continuar.
      </p>
    </div>
    <SignOutButton />
  </main>
);

export default DeactivatedAccountPage;
