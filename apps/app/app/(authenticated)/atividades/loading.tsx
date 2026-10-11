import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";

const ActivitiesLoading = () => (
  <div data-route-loading>
    <LearningPageFrame title="Atividades" variant="catalog">
      <div className="activity-list">
        <Skeleton className="h-12 w-48" />
        {["one", "two", "three"].map((id) => (
          <div className="activity-list-row" key={id}>
            <Skeleton className="size-10 shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-11 w-32" />
          </div>
        ))}
      </div>
    </LearningPageFrame>
  </div>
);
export default ActivitiesLoading;
