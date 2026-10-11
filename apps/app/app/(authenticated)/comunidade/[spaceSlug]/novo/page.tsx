import { redirect } from "next/navigation";

interface NewCommunitySpacePageProperties {
  readonly params: Promise<{ spaceSlug: string }>;
}

const NewCommunitySpacePage = async ({
  params,
}: NewCommunitySpacePageProperties) => {
  const { spaceSlug } = await params;
  redirect(`/comunidade/${spaceSlug}`);
};

export default NewCommunitySpacePage;
