import "server-only";

import { database, HomeBlockType } from "@repo/database";
import { cache } from "react";

export interface HomeBlockConfig {
  readonly collectionId: string | null;
  readonly enabled: boolean;
  readonly itemCount: number;
  readonly position: number;
  readonly subtitle: string | null;
  readonly title: string | null;
  readonly type: HomeBlockType;
}

const defaultHomeBlocks: readonly HomeBlockConfig[] = [
  {
    collectionId: null,
    enabled: true,
    itemCount: 1,
    position: 10,
    subtitle: null,
    title: null,
    type: HomeBlockType.NEXT_MEETING,
  },
  {
    collectionId: null,
    enabled: true,
    itemCount: 4,
    position: 20,
    subtitle: null,
    title: null,
    type: HomeBlockType.PREPARATION,
  },
  {
    collectionId: null,
    enabled: true,
    itemCount: 4,
    position: 30,
    subtitle: null,
    title: null,
    type: HomeBlockType.CONTINUE_WATCHING,
  },
  {
    collectionId: null,
    enabled: true,
    itemCount: 4,
    position: 40,
    subtitle: null,
    title: null,
    type: HomeBlockType.PENDING_ACTIVITY,
  },
  {
    collectionId: null,
    enabled: true,
    itemCount: 4,
    position: 50,
    subtitle: null,
    title: null,
    type: HomeBlockType.FEEDBACK,
  },
  {
    collectionId: null,
    enabled: true,
    itemCount: 4,
    position: 60,
    subtitle: null,
    title: null,
    type: HomeBlockType.ASYNC_LEARNING,
  },
  {
    collectionId: null,
    enabled: true,
    itemCount: 4,
    position: 70,
    subtitle: null,
    title: null,
    type: HomeBlockType.COMMUNITY,
  },
];

export const getHomeBlockConfigurations = cache(async () => {
  const persisted = await database.homeBlockConfiguration.findMany({
    orderBy: [{ position: "asc" }, { type: "asc" }],
    select: {
      collectionId: true,
      enabled: true,
      itemCount: true,
      position: true,
      subtitle: true,
      title: true,
      type: true,
    },
  });
  const persistedByType = new Map(
    persisted.map((configuration) => [configuration.type, configuration])
  );

  return defaultHomeBlocks
    .map((fallback) => persistedByType.get(fallback.type) ?? fallback)
    .sort((left, right) => left.position - right.position);
});

export const getDefaultHomeBlocks = () => [...defaultHomeBlocks];
