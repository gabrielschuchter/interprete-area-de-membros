import { auth } from "@repo/auth/server";
import { database, MemberRole } from "@repo/database";
import { NextResponse } from "next/server";
import { getMemberRole } from "@/lib/authorization";
import { getMemberDirectory } from "@/lib/profile";

const groupFor = (input: {
  readonly displayName: string;
  readonly id: string;
  readonly recipientCount: number;
  readonly username: string;
}) => ({
  ...input,
  avatarUrl: null,
  kind: "GROUP" as const,
  role: "MEMBER",
});

export const GET = async (request: Request) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const [profiles, role] = await Promise.all([
      getMemberDirectory(query),
      getMemberRole(userId),
    ]);
    const normalizedQuery = query.trim().toLowerCase();
    const groups: {
      readonly displayName: string;
      readonly id: string;
      readonly recipientCount: number;
      readonly username: string;
    }[] = [];

    if (role === MemberRole.ADMIN) {
      const [allCount, teacherCount, studentCount] = await Promise.all([
        database.member.count(),
        database.member.count({
          where: { role: { in: [MemberRole.ADMIN, MemberRole.TEACHER] } },
        }),
        database.member.count({ where: { role: MemberRole.MEMBER } }),
      ]);
      groups.push(
        groupFor({
          displayName: "Todos os membros",
          id: "group:ALL",
          recipientCount: allCount,
          username: "todos",
        }),
        groupFor({
          displayName: "Professores e administradores",
          id: "group:STAFF",
          recipientCount: teacherCount,
          username: "professores",
        }),
        groupFor({
          displayName: "Alunos",
          id: "group:STUDENTS",
          recipientCount: studentCount,
          username: "alunos",
        })
      );
    } else if (role === MemberRole.TEACHER) {
      const studentCount = await database.member.count({
        where: { role: MemberRole.MEMBER },
      });
      groups.push(
        groupFor({
          displayName: "Grupo de alunos",
          id: "group:STUDENTS",
          recipientCount: studentCount,
          username: "grupo",
        })
      );
    }

    const matchingGroups = normalizedQuery
      ? groups.filter(
          (group) =>
            group.username.includes(normalizedQuery) ||
            group.displayName.toLowerCase().includes(normalizedQuery)
        )
      : groups;
    return NextResponse.json({
      items: [
        ...matchingGroups,
        ...profiles.map((profile) => ({
          id: profile.clerkUserId,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          kind: "USER" as const,
          role: profile.member.role,
        })),
      ].slice(0, 48),
    });
  } catch (error) {
    console.error("Member search failed", error);
    return NextResponse.json(
      { error: "Não foi possível buscar membros." },
      { status: 500 }
    );
  }
};
