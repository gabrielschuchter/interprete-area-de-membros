import { notFound } from "next/navigation";
import { GestaoMeetingEditorPage } from "../editor-loader";

const GestaoEditMeetingPage = async ({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const page = await GestaoMeetingEditorPage({ meetingId: id });
  if (!page) {
    notFound();
  }
  return page;
};

export default GestaoEditMeetingPage;
