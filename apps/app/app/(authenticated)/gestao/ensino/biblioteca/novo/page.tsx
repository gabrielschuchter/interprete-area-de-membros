import { randomUUID } from "node:crypto";
import { GestaoLibraryItemForm } from "@/components/gestao/library-item-form";
import { getCourseOptions } from "@/lib/admin-learning";
import { requireGestaoAction } from "@/lib/gestao-authorization";

const GestaoNewLibraryItemPage = async () => {
  await requireGestaoAction("content.manage");
  const courses = await getCourseOptions();
  return (
    <section className="gt-page gk-library">
      <GestaoLibraryItemForm
        courses={courses}
        idempotencyKey={randomUUID()}
        item={null}
      />
    </section>
  );
};

export default GestaoNewLibraryItemPage;
