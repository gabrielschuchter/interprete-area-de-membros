import type { Metadata } from "next";
import MeetingsPageContent from "@/components/meetings/meetings-page-content";

const CommunityMeetingsPage = () => <MeetingsPageContent inCommunity />;

export default CommunityMeetingsPage;

export const metadata: Metadata = { title: "Encontros | Interprete" };
