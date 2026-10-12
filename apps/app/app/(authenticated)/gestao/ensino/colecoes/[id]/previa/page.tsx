import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { collectionCoverStyle } from "@/lib/collection-covers";
import { getGestaoCollectionPreviewData } from "@/lib/gestao-collections";

interface GestaoCollectionPreviewPageProperties {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{ readonly pagina?: string }>;
}

const typeLabel = (type: string) => {
  if (type === "LESSON") {
    return "Aprender";
  }
  if (type === "COURSE") {
    return "Curso";
  }
  if (type === "EXERCISE_LIST") {
    return "Exercícios";
  }
  if (type === "RECORDING") {
    return "Encontro gravado";
  }
  return "Biblioteca";
};

const GestaoCollectionPreviewPage = async ({
  params,
  searchParams,
}: GestaoCollectionPreviewPageProperties) => {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getGestaoCollectionPreviewData({ id, page: query.pagina });
  if (!data) {
    notFound();
  }
  const collection = data.collection;
  const editorHref = `/gestao/ensino/colecoes/${collection.id}`;

  return (
    <section className="gestao-page-content gco-preview-page">
      <div className="gco-preview-banner">
        <div>
          <strong>Prévia para aluno · somente leitura</strong>
          <span>
            Nenhuma visualização, conclusão ou progresso será registrado nesta
            tela.
          </span>
        </div>
        <Button asChild variant="outline">
          <Link href={editorHref} prefetch={false}>
            Voltar ao editor
          </Link>
        </Button>
      </div>
      <article className="gco-student-preview">
        <p className="gestao-eyebrow">Curadoria · Interprete</p>
        <h1>{collection.title}</h1>
        <p className="gco-student-description">
          {collection.description ??
            "Uma seleção editorial para continuar uma conversa com calma."}
        </p>
        {collection.coverUrl ? (
          <div
            aria-label={`Capa da coleção ${collection.title}`}
            className="gco-student-cover"
            role="img"
            style={collectionCoverStyle(collection.coverUrl)}
          />
        ) : null}
        <p className="gco-student-count">
          {data.itemCount} {data.itemCount === 1 ? "recurso" : "recursos"}
        </p>
        {data.items.length === 0 ? (
          <p className="gco-preview-empty">
            Esta curadoria ainda não tem recursos.
          </p>
        ) : (
          <ol
            aria-label="Recursos incluídos na coleção"
            className="gco-student-list"
          >
            {data.items.map((item, index) => (
              <li key={item.id}>
                <span className="gco-student-number">
                  {String((data.page - 1) * 100 + index + 1).padStart(2, "0")}
                </span>
                <span className="gco-student-item-copy">
                  <strong>{item.label}</strong>
                  <small>{typeLabel(item.itemType)}</small>
                </span>
              </li>
            ))}
          </ol>
        )}
        {data.pageCount > 1 ? (
          <nav
            aria-label="Páginas da prévia"
            className="gco-preview-pagination"
          >
            {data.page > 1 ? (
              <Link
                href={`${editorHref}/previa?pagina=${data.page - 1}`}
                prefetch={false}
              >
                Recursos anteriores
              </Link>
            ) : (
              <span />
            )}
            <span>
              Página {data.page} de {data.pageCount}
            </span>
            {data.page < data.pageCount ? (
              <Link
                href={`${editorHref}/previa?pagina=${data.page + 1}`}
                prefetch={false}
              >
                Próximos recursos
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </article>
    </section>
  );
};

export default GestaoCollectionPreviewPage;
