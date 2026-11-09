import type { Metadata } from "next";
import MeetingsPageContent from "@/components/meetings/meetings-page-content";

const CommunityMeetingsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  return (
    <MeetingsPageContent
      calendarMonth={typeof params.mes === "string" ? params.mes : undefined}
      inCommunity
      view={params.ver === "calendario" ? "calendar" : "list"}
    />
  );
};

export default CommunityMeetingsPage;

export const metadata: Metadata = { title: "Encontros | Interprete" };
