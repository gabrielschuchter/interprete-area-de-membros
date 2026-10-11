import { portalMarkupTemplate } from "@/components/portal/portal-markup";
import { PortalView } from "@/components/portal/portal-view";
import { requireMemberId } from "@/lib/learning";
import { upcomingPlannerNotice } from "@/lib/planner";

const PortalPage = async () => {
  const memberId = await requireMemberId();
  const notice = await upcomingPlannerNotice(memberId);
  return (
    <PortalView
      markup={portalMarkupTemplate}
      notice={
        notice
          ? { ...notice, timezone: notice.timezone ?? "America/Sao_Paulo" }
          : null
      }
    />
  );
};

export default PortalPage;
