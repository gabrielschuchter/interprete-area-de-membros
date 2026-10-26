import RecordingLibraryPageContent from "@/components/meetings/recording-library-page-content";

export const dynamic = "force-dynamic";

interface CommunityRecordingsPageProperties {
  readonly searchParams: Promise<{
    readonly asset?: string;
    readonly cursor?: string;
    readonly q?: string;
    readonly year?: string;
  }>;
}

const CommunityRecordingsPage = ({
  searchParams,
}: CommunityRecordingsPageProperties) => (
  <RecordingLibraryPageContent inCommunity searchParams={searchParams} />
);

export default CommunityRecordingsPage;
