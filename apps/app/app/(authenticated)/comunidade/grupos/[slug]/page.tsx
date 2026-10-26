import CommunitySpacePage from "@/components/community/community-space-page";

interface CommunityGroupRouteProperties {
  readonly params: Promise<{ readonly slug: string }>;
  readonly searchParams: Promise<{ readonly page?: string }>;
}

const CommunityGroupPage = async ({
  params,
  searchParams,
}: CommunityGroupRouteProperties) => {
  const { slug } = await params;
  return (
    <CommunitySpacePage
      params={Promise.resolve({ spaceSlug: slug })}
      searchParams={searchParams}
    />
  );
};

export default CommunityGroupPage;
