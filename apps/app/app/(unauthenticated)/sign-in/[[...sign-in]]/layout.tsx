import Image from "next/image";
import type { ReactNode } from "react";

interface SignInLayoutProps {
  readonly children: ReactNode;
}

const SignInLayout = ({ children }: SignInLayoutProps) => (
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

    <section aria-label="Acesso à conta" className="interprete-login__auth">
      <div className="interprete-login__auth-column">
        <div className="interprete-login__card">
          <header className="interprete-login__card-header">
            <h2>Entrar</h2>
            <p>
              Bem-vindo de volta à Interprete.
              <br />
              Acesse sua conta para continuar sua jornada.
            </p>
          </header>

          {children}

          <div className="interprete-login__help">
            <p>
              <span aria-hidden="true">?</span>
              Precisa de ajuda para acessar?
            </p>
            <a href="/suporte">
              Fale com o time <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <footer className="interprete-login__footer">
          <a href="/termos-de-uso">Termos de uso</a>
          <span aria-hidden="true">|</span>
          <a href="/privacidade">Privacidade</a>
          <span aria-hidden="true">|</span>
          <a href="/suporte">Suporte</a>
        </footer>
      </div>
    </section>
  </main>
);

export default SignInLayout;
