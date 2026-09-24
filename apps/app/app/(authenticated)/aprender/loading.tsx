import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";

const LearningLoading = () => (
  <LearningPageFrame title="Aprender">
    <div className="grid gap-4 md:grid-cols-2">
      {["one", "two", "three", "four"].map((item) => (
        <div className="paper-surface space-y-4 border p-6" key={item}>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  </LearningPageFrame>
);

export default LearningLoading;
