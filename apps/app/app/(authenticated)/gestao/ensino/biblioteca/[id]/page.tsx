import { notFound } from "next/navigation";
import { GestaoLibraryItemForm } from "@/components/gestao/library-item-form";
import { getCourseOptions } from "@/lib/admin-learning";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoLibraryItemForEdit } from "@/lib/gestao-library";

const GestaoEditLibraryItemPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) => {
  await requireGestaoAction("content.manage");
  const { id } = await params;
  const item = await getGestaoLibraryItemForEdit(id);
  if (!item) {
    notFound();
  }
  const courses = await getCourseOptions();
  return (
    <section className="gestao-page-content gl-page">
      <header className="gl-material-heading">
        <div>
          <p className="gestao-eyebrow">
            Gestão › Ensino › Biblioteca › Editar
          </p>
          <h1>Editar material</h1>
          <p>As alterações ficam registradas no material existente.</p>
        </div>
      </header>
      <GestaoLibraryItemForm courses={courses} item={item} />
    </section>
  );
};

export default GestaoEditLibraryItemPage;
