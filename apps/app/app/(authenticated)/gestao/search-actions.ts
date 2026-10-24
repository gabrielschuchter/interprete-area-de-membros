"use server";

import { type GestaoSearchGroup, searchGestao } from "@/lib/gestao-search";

export const searchGestaoAction = async (
  query: string
): Promise<readonly GestaoSearchGroup[]> => {
  if (typeof query !== "string") {
    return [];
  }
  return await searchGestao(query);
};
