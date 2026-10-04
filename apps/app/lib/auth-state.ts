export const applyMemberDeactivation = <
  T extends {
    userId: string | null;
    isAuthenticated: boolean;
  },
>(
  session: T,
  deactivated: boolean
) => {
  const memberDeactivated = Boolean(session.userId && deactivated);

  return {
    ...session,
    isAuthenticated: memberDeactivated ? false : session.isAuthenticated,
    memberDeactivated,
    userId: memberDeactivated ? null : session.userId,
  };
};
