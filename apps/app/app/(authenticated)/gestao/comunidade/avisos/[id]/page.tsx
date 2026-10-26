import { notFound } from "next/navigation";
import { GestaoNoticeEditorPage } from "../editor-loader";

const GestaoEditNoticePage = async ({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const page = await GestaoNoticeEditorPage({ noticeId: id });
  if (!page) {
    notFound();
  }
  return page;
};

export default GestaoEditNoticePage;
