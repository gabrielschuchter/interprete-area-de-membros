import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { GestaoCollectionEditor } from "@/components/gestao/collection-editor";
import { getGestaoCollectionEditorData } from "@/lib/gestao-collections";

const NewGestaoCollectionPage = async () => {
  const data = await getGestaoCollectionEditorData({});
  if (!data) {
    notFound();
  }

  return (
    <GestaoCollectionEditor
      addItemIdempotencyKey={randomUUID()}
      data={data}
      defaultPublishMode="now"
      idempotencyKey={randomUUID()}
    />
  );
};

export default NewGestaoCollectionPage;
