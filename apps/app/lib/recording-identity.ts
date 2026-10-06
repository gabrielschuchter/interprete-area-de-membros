export const recordingOwnerDisplayLabel = (
  groupMemberId: string | null,
  memberId: string,
  fullAccess: boolean,
  legacyStudentName: string
) =>
  fullAccess || groupMemberId === memberId
    ? legacyStudentName
    : "Conteúdo atribuído";

export const recordingGroupNameSearchWhere = (
  memberId: string,
  fullAccess: boolean,
  query: string
) => ({
  ...(fullAccess ? {} : { memberId }),
  legacyStudentName: { contains: query, mode: "insensitive" as const },
});
