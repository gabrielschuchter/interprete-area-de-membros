import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

interface InterpreteAuthShellProperties {
  readonly accountActionLabel: string;
  readonly accountHref: string;
  readonly accountPrompt: string;
  readonly children: ReactNode;
  readonly description: ReactNode;
  readonly title: string;
}

export const InterpreteAuthShell = ({
  accountActionLabel,
  accountHref,
  accountPrompt,
  children,
  description,
  title,
}: InterpreteAuthShellProperties) => (
  <main className="interprete-login">
    <section aria-label="Interprete" className="interprete-login__brand">
      <span className="interprete-login__mark">I.</span>

      <div className="interprete-login__copy">
        <p className="interprete-login__eyebrow">
          Escola de prática baseada em evidências
        </p>
        <h1>
          Não aceite a
          <br />
          evidência. Interprete.
        </h1>
        <p>
          Um espaço para estudar, discutir e construir decisões clínicas
          baseadas em evidências
        </p>
      </div>

      <Image
        alt=""
        aria-hidden="true"
        className="interprete-login__architecture"
        fill
        priority
        sizes="(min-width: 1024px) 32vw, 0px"
        src="/brand/login/login-architecture.webp"
      />
      <Image
        alt=""
        aria-hidden="true"
        className="interprete-login__stone"
        height={557}
        priority
        sizes="(min-width: 1024px) 42vw, 0px"
        src="/brand/login/login-stone.webp"
        width={810}
      />
    </section>

    <section aria-label="Autenticação da conta" className="interprete-login__auth">
      <div className="interprete-login__auth-column">
        <div className="interprete-login__card">
          <header className="interprete-login__card-header">
            <h2>{title}</h2>
            <p>{description}</p>
          </header>

          {children}

          <p className="interprete-login__account-switch">
            <span>{accountPrompt}</span>{" "}
            <Link href={accountHref}>{accountActionLabel}</Link>
          </p>

          <div className="interprete-login__help">
            <p>
              <span aria-hidden="true">?</span>
              Precisa de ajuda para acessar?
            </p>
            <Link href="/suporte">
              Fale com o time <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <footer className="interprete-login__footer">
          <Link href="/termos-de-uso">Termos de uso</Link>
          <span aria-hidden="true">|</span>
          <Link href="/privacidade">Privacidade</Link>
          <span aria-hidden="true">|</span>
          <Link href="/suporte">Suporte</Link>
        </footer>
      </div>
    </section>
  </main>
);
