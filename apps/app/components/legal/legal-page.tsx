import Link from "next/link";
import type { ReactNode } from "react";

export interface LegalSection {
  readonly body: ReactNode;
  readonly id: string;
  readonly title: string;
}

interface LegalPageProperties {
  readonly description: string;
  readonly eyebrow: string;
  readonly sections: readonly LegalSection[];
  readonly title: string;
  readonly updatedAt?: string;
}

const pages = [
  { href: "/termos-de-uso", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/suporte", label: "Suporte" },
] as const;

export const LegalPage = ({
  description,
  eyebrow,
  sections,
  title,
  updatedAt,
}: LegalPageProperties) => (
  <div className="legal-page">
    <header className="legal-page__bar">
      <Link className="legal-page__back" href="/sign-in">
        <span aria-hidden="true">←</span> Voltar para entrar
      </Link>
      <span aria-hidden="true" className="legal-page__mark">
        I.
      </span>
    </header>

    <main className="legal-page__main">
      <p className="legal-page__eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="legal-page__lead">{description}</p>
      {updatedAt ? (
        <p className="legal-page__updated">Atualizado em {updatedAt}</p>
      ) : null}

      {sections.length > 2 ? (
        <nav aria-label="Nesta página" className="legal-page__toc">
          {sections.map((section) => (
            <a href={`#${section.id}`} key={section.id}>
              {section.title}
            </a>
          ))}
        </nav>
      ) : null}

      {sections.map((section) => (
        <section
          aria-labelledby={`${section.id}-titulo`}
          className="legal-page__section"
          id={section.id}
          key={section.id}
        >
          <h2 id={`${section.id}-titulo`}>{section.title}</h2>
          {section.body}
        </section>
      ))}
    </main>

    <footer className="legal-page__footer">
      <nav aria-label="Outras páginas">
        {pages.map((page) => (
          <Link href={page.href} key={page.href}>
            {page.label}
          </Link>
        ))}
      </nav>
      <Link className="legal-page__footer-back" href="/sign-in">
        Voltar para entrar
      </Link>
    </footer>
  </div>
);
