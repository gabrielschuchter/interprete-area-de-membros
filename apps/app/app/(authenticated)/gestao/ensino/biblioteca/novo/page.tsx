import { randomUUID } from "node:crypto";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { GestaoLibraryItemForm } from "@/components/gestao/library-item-form";
import { getCourseOptions } from "@/lib/admin-learning";
import { requireGestaoAction } from "@/lib/gestao-authorization";

const GestaoNewLibraryItemPage = async () => {
  await requireGestaoAction("content.manage");
  const courses = await getCourseOptions();
  return (
    <section className="gestao-page-content gl-page">
      <header className="gl-material-heading">
        <div>
          <p className="gestao-eyebrow">
            Gestão <span aria-hidden="true">›</span> Ensino{" "}
            <span aria-hidden="true">›</span>{" "}
            <Link href="/gestao/ensino/biblioteca" prefetch={false}>
              Biblioteca
            </Link>
            <span aria-hidden="true">›</span> Novo material
          </p>
          <h1>Novo material</h1>
          <p>
            Escolha um tipo e preencha os metadados que ajudam a encontrar este
            recurso.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/gestao/ensino/biblioteca" prefetch={false}>
            Voltar à biblioteca
          </Link>
        </Button>
      </header>
      <GestaoLibraryItemForm
        courses={courses}
        idempotencyKey={randomUUID()}
        item={null}
      />
    </section>
  );
};

export default GestaoNewLibraryItemPage;
