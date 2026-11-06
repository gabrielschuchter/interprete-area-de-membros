import "server-only";

import { database } from "@repo/database";
import { deleteMemberAsset, memberAssetPathFromUrl } from "./member-storage";

const ASSET_REFERENCE = /\/api\/member-assets\?path=([^"'\s)<>\\]+)/g;

const COMMUNITY_PREFIXES = [
  "community-assets/covers/",
  "community-assets/inline/",
  "community-assets/attachments/",
];

/** Caminhos de arquivos da Comunidade citados em capas e no texto. */
export const collectCommunityAssetPaths = (
  sources: readonly (string | null | undefined)[]
) => {
  const paths = new Set<string>();
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const direct = memberAssetPathFromUrl(source);
    if (direct) {
      paths.add(direct);
    }
    for (const match of source.matchAll(ASSET_REFERENCE)) {
      try {
        paths.add(decodeURIComponent(match[1] ?? ""));
      } catch {
        // Referência malformada: não há arquivo a remover.
      }
    }
  }
  return [...paths].filter((path) =>
    COMMUNITY_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
};

/**
 * Remove do armazenamento os arquivos que ficaram sem uso depois de uma
 * exclusão definitiva. Um arquivo que ainda aparece em outra publicação ou
 * grupo é mantido. Falha de armazenamento nunca desfaz a exclusão: o que
 * sobrar é apenas um arquivo órfão.
 */
export const removeUnreferencedCommunityAssets = async (
  paths: readonly string[]
) => {
  let removed = 0;
  for (const path of paths) {
    const fragment = encodeURIComponent(path);
    const [posts, spaces] = await Promise.all([
      database.communityPost.count({
        where: {
          OR: [
            { content: { contains: fragment } },
            { coverUrl: { contains: fragment } },
          ],
        },
      }),
      database.communitySpace.count({
        where: { coverUrl: { contains: fragment } },
      }),
    ]);
    if (posts + spaces > 0) {
      continue;
    }
    try {
      if (await deleteMemberAsset(path)) {
        removed += 1;
      }
    } catch {
      // Arquivo órfão; a exclusão do grupo já foi concluída.
    }
  }
  return removed;
};
