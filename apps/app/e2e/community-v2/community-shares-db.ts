import { readFileSync } from "node:fs";
import { database } from "@repo/database";

interface Request {
  readonly input: Record<string, unknown>;
  readonly operation: string;
}

const createPost = async ({
  authorId,
  content,
  coverAltText,
  coverUrl,
  excerpt,
  subtitle,
  spaceId,
  tags,
  title,
}: {
  readonly authorId: string;
  readonly content: string;
  readonly coverAltText?: string;
  readonly coverUrl?: string;
  readonly excerpt: string;
  readonly subtitle?: string;
  readonly spaceId?: string | null;
  readonly tags?: string[];
  readonly title: string;
}) =>
  database.communityPost.create({
    data: {
      authorId,
      content,
      coverAltText,
      coverUrl,
      excerpt,
      kind: "DISCUSSION",
      publishedAt: new Date(),
      spaceId: spaceId ?? null,
      audienceScope: spaceId ? "GROUP" : "GLOBAL",
      status: "PUBLISHED",
      subtitle,
      tags,
      title,
    },
    select: { id: true, title: true },
  });

const query = async ({ operation, input }: Request) => {
  switch (operation) {
    case "create-fixtures": {
      const ownerId = input.ownerId as string;
      const runId = input.runId as string;
      const privateTitle = `Etapa 07 privada ${runId}`;
      const publicTitle = `Etapa 07 pública ${runId}`;
      const privateExcerpt = `Trecho privado ${runId}`;
      const privateCoverAlt = `Capa privada ${runId}`;
      const privateComment = `Comentário privado ${runId}`;
      const slugSuffix = runId.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      const space = await database.communitySpace.create({
        data: {
          title: `Grupo privado Etapa 07 ${runId}`,
          slug: `share-qa-${slugSuffix}`.slice(0, 100),
          description: `Descrição privada ${runId}`,
          details: `Detalhes privados ${runId}`,
          ownerId,
          status: "PUBLISHED",
          visibility: "PRIVATE",
        },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          details: true,
        },
      });
      const [privatePost, publicPost] = await Promise.all([
        createPost({
          authorId: ownerId,
          content: `Corpo privado ${runId}`,
          coverAltText: privateCoverAlt,
          coverUrl: `/api/member-assets?path=community-assets/covers/${ownerId}/share-qa-${slugSuffix}.png`,
          excerpt: privateExcerpt,
          spaceId: space.id,
          title: privateTitle,
        }),
        createPost({
          authorId: ownerId,
          content: `Corpo público ${runId}\n\nUma conversa sobre aprendizagem compartilhada e novas perspectivas.`,
          excerpt: `Trecho público ${runId}`,
          subtitle: `Uma pergunta para a comunidade ${runId}`,
          tags: ["aprendizagem", "comunidade"],
          title: publicTitle,
        }),
      ]);
      const [privateCommentRow, publicCommentRow] = await Promise.all([
        database.communityComment.create({
          data: {
            authorId: ownerId,
            content: privateComment,
            postId: privatePost.id,
          },
        }),
        database.communityComment.create({
          data: {
            authorId: ownerId,
            content: `Resposta pública ${runId}`,
            postId: publicPost.id,
          },
        }),
      ]);
      return {
        privatePost,
        publicPost,
        privateExcerpt,
        privateCoverAlt,
        privateComment: privateCommentRow.content,
        publicComment: publicCommentRow.content,
        publicSubtitle: `Uma pergunta para a comunidade ${runId}`,
        space,
      };
    }
    case "set-membership": {
      const spaceId = input.spaceId as string;
      const memberId = input.memberId as string;
      if (input.active === false) {
        return database.communitySpaceMember.deleteMany({
          where: { spaceId, memberId },
        });
      }
      return database.communitySpaceMember.upsert({
        where: { spaceId_memberId: { spaceId, memberId } },
        create: { spaceId, memberId, role: "MEMBER" },
        update: { role: "MEMBER" },
        select: { id: true, role: true },
      });
    }
    case "share-link-evidence":
      return database.communityPostShareLink.findMany({
        where: { postId: input.postId as string },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          tokenHash: true,
          createdById: true,
          createdAt: true,
          revokedAt: true,
        },
      });
    case "private-access-audit-count":
      return database.domainEvent.count({
        where: {
          actorId: input.actorId as string,
          aggregateId: input.spaceId as string,
          eventType: "community.group.private_post_accessed",
        },
      });
    case "delete-group-with-post": {
      const spaceId = input.spaceId as string;
      const postId = input.postId as string;
      let blocked = false;
      try {
        await database.communitySpace.delete({ where: { id: spaceId } });
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          error.code !== "P2003"
        ) {
          throw error;
        }
        blocked = true;
      }
      const post = await database.communityPost.findUnique({
        where: { id: postId },
        select: { audienceScope: true, spaceId: true },
      });
      return { blocked, post };
    }
    case "member-details":
      return database.member.findMany({
        where: { id: { in: input.memberIds as string[] }, deactivatedAt: null },
        select: {
          id: true,
          profile: { select: { displayName: true, username: true } },
        },
      });
    case "cleanup": {
      const spaceId = input.spaceId as string;
      const postIds = input.postIds as string[];
      await database.domainEvent.deleteMany({
        where: {
          aggregateId: spaceId,
          eventType: "community.group.private_post_accessed",
        },
      });
      await database.communityPost.deleteMany({
        where: { id: { in: postIds } },
      });
      return database.communitySpace.deleteMany({ where: { id: spaceId } });
    }
    default:
      throw new Error(
        `Unsupported Community V2 share QA operation: ${operation}`
      );
  }
};

const databaseUrl = new URL(process.env.DATABASE_URL ?? "http://invalid.local");
if (
  process.env.COMMUNITY_QA_ISOLATED !== "true" ||
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.port !== "54325" ||
  databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa" ||
  databaseUrl.username !== "community_qa"
) {
  throw new Error(
    "Community share QA is restricted to the guarded local database."
  );
}

try {
  const request = JSON.parse(readFileSync(0, "utf8")) as Request;
  const result = await query(request);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
