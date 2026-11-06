import "server-only";

import { database } from "@repo/database";
import { eraseCommunityPostRecord } from "@/lib/gestao-content-erasure";
import { deleteMemberAsset } from "@/lib/member-storage";

/** Prazo de recuperação das publicações apagadas (mesmo de restoreCommunityPost). */
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const batchSize = 25;

/**
 * Esvazia a lixeira da Comunidade: publicações e comentários apagados há mais
 * de 30 dias saem do banco de vez, junto com as imagens e anexos no Storage
 * que só eles usavam. Roda na rotina diária.
 */
export const purgeExpiredCommunityTrash = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - retentionMs);
  const posts = await database.communityPost.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true },
    take: batchSize,
  });
  let postsPurged = 0;
  const files = new Set<string>();
  for (const { id } of posts) {
    const paths = new Set<string>();
    try {
      await database.$transaction((tx) =>
        eraseCommunityPostRecord(tx, id, paths)
      );
      postsPurged += 1;
      for (const path of paths) {
        files.add(path);
      }
    } catch {
      // Segue com os demais; a próxima rodada tenta de novo.
    }
  }
  const comments = await database.communityComment.deleteMany({
    where: { deletedAt: { lt: cutoff }, replies: { none: {} } },
  });
  await Promise.all(
    [...files].map((path) => deleteMemberAsset(path).catch(() => false))
  );
  return {
    commentsPurged: comments.count,
    filesRemoved: files.size,
    postsPurged,
  };
};
