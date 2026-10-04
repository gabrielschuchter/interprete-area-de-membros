import { describe, expect, it } from "vitest";
import { LIBRARY_PAGE_SIZE, pageLibraryRows } from "../lib/library-pagination";

describe("paginação da biblioteca", () => {
  const rows = Array.from({ length: 55 }, (_, index) => index);

  it("preserva a página já deslocada da consulta recente e usa sentinela", () => {
    const result = pageLibraryRows(
      rows.slice(LIBRARY_PAGE_SIZE, LIBRARY_PAGE_SIZE * 2 + 1),
      2,
      { rowsAlreadyOffset: true }
    );

    expect(result.items).toEqual(
      rows.slice(LIBRARY_PAGE_SIZE, LIBRARY_PAGE_SIZE * 2)
    );
    expect(result.hasMore).toBe(true);
  });

  it("desloca candidatos de relevância uma única vez e encerra na última página", () => {
    const result = pageLibraryRows(rows, 3);

    expect(result.items).toEqual(rows.slice(LIBRARY_PAGE_SIZE * 2));
    expect(result.hasMore).toBe(false);
  });
});
