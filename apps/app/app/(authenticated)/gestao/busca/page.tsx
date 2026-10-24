import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { gestaoSearchMinLength, searchGestao } from "@/lib/gestao-search";
import { GestaoPageHeading } from "../gestao-shell";

const GestaoSearchPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  await requireGestaoActor();
  const params = await searchParams;
  if (Array.isArray(params.q)) {
    forbidden();
  }
  const query = (params.q ?? "").trim().slice(0, 120);
  const groups =
    query.length >= gestaoSearchMinLength ? await searchGestao(query) : [];
  return (
    <section className="gx-page">
      <GestaoPageHeading
        description="Alunos, turmas, atividades, cursos, aulas, materiais, avisos e encontros que você pode ver."
        eyebrow="Gestão · Busca"
        title="Buscar em Gestão"
      />
      <form action="/gestao/busca" className="gx-search-form" method="get">
        <label>
          <span className="sr-only">Termo de busca</span>
          <input
            autoComplete="off"
            defaultValue={query}
            maxLength={120}
            name="q"
            placeholder="Aluno, turma, atividade, curso, material…"
            type="search"
          />
        </label>
        <button className="gx-button" type="submit">
          Buscar
        </button>
      </form>
      {query.length < gestaoSearchMinLength ? (
        <p className="gx-muted">
          Digite ao menos {gestaoSearchMinLength} letras para buscar.
        </p>
      ) : null}
      {query.length >= gestaoSearchMinLength && groups.length === 0 ? (
        <div className="gestao-empty-state">
          <h2>Nada encontrado para “{query}”</h2>
          <p>Confira a grafia ou tente uma parte do nome.</p>
        </div>
      ) : null}
      {groups.map((group) => (
        <section aria-label={group.label} className="gx-card" key={group.key}>
          <h2>{group.label}</h2>
          <ul className="gx-list">
            {group.results.map((result) => (
              <li key={result.id}>
                <Link href={result.href} prefetch={false}>
                  <strong>{result.title}</strong>
                  <span>{result.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
};

export default GestaoSearchPage;
