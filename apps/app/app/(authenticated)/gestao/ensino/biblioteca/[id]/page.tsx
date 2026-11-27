import { notFound } from "next/navigation";
import { ContentLinksSection } from "@/components/gestao/content-links-section";
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
    <section className="gt-page gk-library">
      <GestaoLibraryItemForm courses={courses} item={item} />
      <ContentLinksSection source={{ id: item.id, side: "libraryItem" }} />
    </section>
  );
};

export default GestaoEditLibraryItemPage;
