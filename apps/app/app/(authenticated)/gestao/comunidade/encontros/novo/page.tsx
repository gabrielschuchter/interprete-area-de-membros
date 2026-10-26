import { GestaoMeetingEditorPage } from "../editor-loader";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const GestaoNewMeetingPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const date = read("data");
  return (
    <GestaoMeetingEditorPage
      meetingId={null}
      presetCohortId={read("turma")}
      presetDate={date && datePattern.test(date) ? date : undefined}
    />
  );
};

export default GestaoNewMeetingPage;
