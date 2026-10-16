import { redirect } from "next/navigation";

interface LegacyCommunitySpacePageProperties {
  readonly params: Promise<{ readonly spaceSlug: string }>;
}

const LegacyCommunitySpacePage = async ({
  params,
}: LegacyCommunitySpacePageProperties) => {
  const { spaceSlug } = await params;
  redirect(`/comunidade/grupos/${encodeURIComponent(spaceSlug)}`);
};

export default LegacyCommunitySpacePage;
