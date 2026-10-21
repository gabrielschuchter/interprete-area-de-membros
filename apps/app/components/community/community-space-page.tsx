import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityNavigation } from "@/components/community/community-navigation";
import {
  CommunitySpaceAboutView,
  CommunitySpaceHeader,
  CommunitySpaceMembersView,
  CommunitySpacePostsView,
  CommunitySpaceSettingsView,
  CommunitySpaceTabs,
  type GroupView,
} from "@/components/community/community-space-views";
import { getMemberRole } from "@/lib/authorization";
import { getCommunitySpace, getCommunitySpaceMembers } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

interface CommunitySpacePageProperties {
  readonly params: Promise<{ spaceSlug: string }>;
  readonly searchParams: Promise<{
    page?: string;
    memberPage?: string;
    view?: string;
  }>;
}

const parseGroupView = (value?: string): GroupView => {
  if (value === "members" || value === "about" || value === "settings") {
    return value;
  }
  return "posts";
};

const CommunitySpacePage = async ({
  params,
  searchParams,
}: CommunitySpacePageProperties) => {
  const [{ spaceSlug }, filters, memberId] = await Promise.all([
    params,
    searchParams,
    requireMemberId(),
  ]);
  const page = Number.parseInt(filters.page ?? "1", 10);
  const memberPage = Number.parseInt(filters.memberPage ?? "1", 10);
  const space = await getCommunitySpace(spaceSlug, memberId, page);
  if (!space) {
    notFound();
  }

  const role = await getMemberRole(memberId);
  const isStaff = role === "TEACHER" || role === "ADMIN";
  const membership = space.members[0];
  const isOwner = space.ownerId === memberId || membership?.role === "OWNER";
  const isMember = isOwner || Boolean(membership);
  const isModerator = membership?.role === "MODERATOR";
  const isArchived = space.status === "ARCHIVED";
  const canEditGroup = isOwner || isModerator || isStaff;
  const view = parseGroupView(filters.view);
  const activeView = view === "settings" && !canEditGroup ? "posts" : view;
  const canPublish = (isMember || isStaff) && !isArchived;
  const members =
    activeView === "members"
      ? await getCommunitySpaceMembers(space.id, memberPage)
      : null;

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-12">
        <CommunityNavigation active="groups" />
        <Button asChild className="mt-3 -ml-3" variant="ghost">
          <Link href="/comunidade/grupos">
            <ArrowLeftIcon aria-hidden="true" /> Todos os grupos
          </Link>
        </Button>
        <CommunitySpaceHeader
          canEditGroup={canEditGroup}
          canPublish={canPublish}
          isArchived={isArchived}
          isMember={isMember}
          isModerator={isModerator}
          space={space}
        />
        <CommunitySpaceTabs
          canEditGroup={canEditGroup}
          spaceSlug={space.slug}
          view={activeView}
        />
        {activeView === "posts" ? (
          <CommunitySpacePostsView
            isOwner={isOwner}
            isStaff={isStaff}
            memberId={memberId}
            space={space}
          />
        ) : null}
        {activeView === "members" && members ? (
          <CommunitySpaceMembersView
            isOwner={isOwner}
            listing={members}
            space={space}
          />
        ) : null}
        {activeView === "about" ? (
          <CommunitySpaceAboutView space={space} />
        ) : null}
        {activeView === "settings" && canEditGroup ? (
          <CommunitySpaceSettingsView
            isArchived={isArchived}
            isModerator={isModerator}
            isOwner={isOwner}
            space={space}
          />
        ) : null}
      </main>
    </div>
  );
};

export default CommunitySpacePage;
