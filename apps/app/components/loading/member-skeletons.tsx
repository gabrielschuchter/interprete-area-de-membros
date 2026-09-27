import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import type { ReactNode } from "react";

interface LoadingFrameProperties {
  readonly children: ReactNode;
  readonly className?: string;
}

const skeletonKeys = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

const LoadingFrame = ({ children, className = "" }: LoadingFrameProperties) => (
  <main
    className={`mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16 ${className}`}
    data-route-loading
  >
    <output aria-label="Carregando conteúdo" className="block">
      {children}
    </output>
  </main>
);

const PageIntroSkeleton = () => (
  <div className="max-w-3xl">
    <Skeleton className="h-3 w-56" />
    <Skeleton className="mt-6 h-20 w-full max-w-2xl" />
    <Skeleton className="mt-6 h-5 w-full max-w-xl" />
  </div>
);

const SurfaceSkeleton = ({
  className = "",
}: {
  readonly className?: string;
}) => (
  <div className={`paper-surface space-y-4 border p-6 sm:p-8 ${className}`}>
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-9 w-4/5" />
    <Skeleton className="h-4 w-full max-w-xl" />
    <Skeleton className="h-10 w-36" />
  </div>
);

export const HomeLoading = () => (
  <LoadingFrame>
    <PageIntroSkeleton />
    <SurfaceSkeleton className="mt-12 min-h-52" />
    <div className="mt-10 grid gap-5 lg:grid-cols-3">
      {skeletonKeys("home-card", 3).map((key) => (
        <SurfaceSkeleton className="min-h-56" key={key} />
      ))}
    </div>
    <div className="mt-12 border-t pt-6">
      <Skeleton className="h-8 w-72" />
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {skeletonKeys("home-secondary-card", 3).map((key) => (
          <SurfaceSkeleton className="min-h-36" key={key} />
        ))}
      </div>
    </div>
  </LoadingFrame>
);

export const ProfileLoading = () => (
  <LoadingFrame className="max-w-[1120px]">
    <PageIntroSkeleton />
    <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.42fr)]">
      <SurfaceSkeleton className="min-h-[520px]" />
      <div className="space-y-5">
        <SurfaceSkeleton className="min-h-44" />
        <SurfaceSkeleton className="min-h-44" />
      </div>
    </div>
  </LoadingFrame>
);

export const SettingsLoading = () => (
  <LoadingFrame className="max-w-[960px]">
    <PageIntroSkeleton />
    <div className="mt-12 space-y-5">
      <SurfaceSkeleton className="min-h-40" />
      <SurfaceSkeleton className="min-h-64" />
      <SurfaceSkeleton className="min-h-40" />
    </div>
  </LoadingFrame>
);

export const RecordingsLoading = () => (
  <LoadingFrame>
    <PageIntroSkeleton />
    <SurfaceSkeleton className="mt-12 min-h-64" />
    <div className="mt-12 border-b pb-4">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-10 w-72" />
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      {skeletonKeys("recording-card", 4).map((key) => (
        <SurfaceSkeleton className="min-h-44" key={key} />
      ))}
    </div>
  </LoadingFrame>
);

export const NotificationsLoading = () => (
  <LoadingFrame className="max-w-[960px]">
    <PageIntroSkeleton />
    <div className="mt-10 flex gap-2 border-b pb-3">
      {skeletonKeys("notification-filter", 4).map((key) => (
        <Skeleton className="h-9 w-24" key={key} />
      ))}
    </div>
    <div className="mt-6 space-y-2">
      {skeletonKeys("notification-row", 6).map((key) => (
        <div className="flex gap-4 border-b p-5" key={key}>
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  </LoadingFrame>
);

export const CommunityLoading = () => (
  <LoadingFrame>
    <PageIntroSkeleton />
    <div className="mt-10 flex flex-wrap gap-3">
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-10 w-28" />
    </div>
    <div className="mt-8 space-y-5">
      {skeletonKeys("community-card", 4).map((key) => (
        <SurfaceSkeleton className="min-h-36" key={key} />
      ))}
    </div>
  </LoadingFrame>
);

export const MembersLoading = () => (
  <LoadingFrame>
    <PageIntroSkeleton />
    <Skeleton className="mt-10 h-12 w-full max-w-xl" />
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {skeletonKeys("member-card", 6).map((key) => (
        <SurfaceSkeleton className="min-h-48" key={key} />
      ))}
    </div>
  </LoadingFrame>
);

export const AdminLoading = () => (
  <LoadingFrame className="lg:py-14">
    <Skeleton className="h-4 w-40" />
    <Skeleton className="mt-5 h-16 max-w-2xl" />
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {skeletonKeys("admin-card", 3).map((key) => (
        <SurfaceSkeleton className="min-h-36" key={key} />
      ))}
    </div>
  </LoadingFrame>
);

export const LearningLoading = () => (
  <LoadingFrame>
    <PageIntroSkeleton />
    <div className="mt-12 grid gap-4 md:grid-cols-2">
      {skeletonKeys("learning-card", 4).map((key) => (
        <SurfaceSkeleton className="min-h-48" key={key} />
      ))}
    </div>
  </LoadingFrame>
);

export const ActivitiesLoading = () => (
  <LoadingFrame>
    <PageIntroSkeleton />
    <div className="mt-12 space-y-4">
      {skeletonKeys("activity-row", 3).map((key) => (
        <SurfaceSkeleton key={key} />
      ))}
    </div>
  </LoadingFrame>
);

export const MeetingsLoading = () => (
  <LoadingFrame>
    <PageIntroSkeleton />
    <div className="mt-12 grid gap-5 lg:grid-cols-2">
      {skeletonKeys("meeting-card", 2).map((key) => (
        <SurfaceSkeleton key={key} />
      ))}
    </div>
  </LoadingFrame>
);

export const LibraryLoading = () => (
  <LoadingFrame>
    <PageIntroSkeleton />
    <div className="mt-12 flex gap-3">
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-10 w-28" />
    </div>
    <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {skeletonKeys("library-card", 6).map((key) => (
        <SurfaceSkeleton className="min-h-56" key={key} />
      ))}
    </div>
  </LoadingFrame>
);
