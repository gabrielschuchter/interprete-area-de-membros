import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { GestaoCollectionEditor } from "@/components/gestao/collection-editor";
import { getGestaoCollectionEditorData } from "@/lib/gestao-collections";

interface GestaoCollectionEditorPageProperties {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{ readonly itensPagina?: string }>;
}

const GestaoCollectionEditorPage = async ({
  params,
  searchParams,
}: GestaoCollectionEditorPageProperties) => {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getGestaoCollectionEditorData({
    id,
    itemPage: query.itensPagina,
  });
  if (!data?.collection) {
    notFound();
  }
  const defaultPublishMode =
    data.collection.availableAt && data.collection.availableAt > new Date()
      ? "schedule"
      : "now";

  return (
    <GestaoCollectionEditor
      addItemIdempotencyKey={randomUUID()}
      data={data}
      defaultPublishMode={defaultPublishMode}
      idempotencyKey={randomUUID()}
    />
  );
};

export default GestaoCollectionEditorPage;
