export type CommunityGroupRole = "OWNER" | "MODERATOR" | "MEMBER";
export type CommunityIdentityRole = "ADMIN" | "TEACHER" | "MEMBER";

export const canEditStudyGroup = (input: {
  readonly isOwner: boolean;
  readonly isModerator: boolean;
  readonly isStaff: boolean;
}) => input.isOwner || input.isModerator || input.isStaff;

export const canManageStudyGroupParticipants = (isOwner: boolean) => isOwner;

export const canChangeStudyGroupPrivacy = (isOwner: boolean) => isOwner;

export const canArchiveStudyGroup = (isOwner: boolean) => isOwner;

export const canChangeStudyGroupMemberRole = (input: {
  readonly isOwner: boolean;
  readonly targetGroupRole: CommunityGroupRole;
  readonly targetIdentityRole: CommunityIdentityRole;
  readonly nextGroupRole: string;
}) =>
  input.isOwner &&
  input.targetGroupRole !== "OWNER" &&
  input.targetIdentityRole === "MEMBER" &&
  (input.nextGroupRole === "MEMBER" || input.nextGroupRole === "MODERATOR");

export const canRemoveStudyGroupMember = (input: {
  readonly isOwner: boolean;
  readonly targetGroupRole: CommunityGroupRole;
}) => input.isOwner && input.targetGroupRole !== "OWNER";

export const canReadPrivateStudyGroup = (input: {
  readonly isOwner: boolean;
  readonly isMember: boolean;
  readonly isStaff: boolean;
}) => input.isOwner || input.isMember || input.isStaff;
