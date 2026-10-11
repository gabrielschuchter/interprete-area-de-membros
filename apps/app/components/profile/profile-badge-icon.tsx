import { BadgeCriterion } from "@repo/database";
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  Clock3Icon,
  FlagIcon,
  ListChecksIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  TargetIcon,
  UsersRoundIcon,
} from "lucide-react";

const iconsByCriterion = {
  [BadgeCriterion.ACTIVITIES_COMPLETED]: NotebookPenIcon,
  [BadgeCriterion.COMMUNITY_PUBLICATIONS]: MessageCircleIcon,
  [BadgeCriterion.EXERCISE_ANSWERS]: ListChecksIcon,
  [BadgeCriterion.LEARNING_PATHS_COMPLETED]: FlagIcon,
  [BadgeCriterion.LESSONS_COMPLETED]: BookOpenIcon,
  [BadgeCriterion.MEETINGS_ATTENDED]: UsersRoundIcon,
  [BadgeCriterion.STUDY_GOALS_MET]: TargetIcon,
  [BadgeCriterion.STUDY_MINUTES]: Clock3Icon,
  [BadgeCriterion.STUDY_STREAK_DAYS]: CalendarDaysIcon,
  [BadgeCriterion.TASKS_COMPLETED]: CircleCheckIcon,
} satisfies Record<BadgeCriterion, typeof Clock3Icon>;

export const ProfileBadgeIcon = ({
  criterion,
  earned = false,
  size = "default",
}: {
  readonly criterion: BadgeCriterion;
  readonly earned?: boolean;
  readonly size?: "default" | "small";
}) => {
  const Icon = iconsByCriterion[criterion];
  const dimension = "size-11";
  const iconDimension = size === "small" ? "size-[18px]" : "size-4";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-full border border-dashed ${earned ? "border-brand-structural/65 text-brand-structural" : "border-border text-muted-foreground"}`}
    >
      <Icon aria-hidden="true" className={iconDimension} strokeWidth={1.5} />
    </span>
  );
};
