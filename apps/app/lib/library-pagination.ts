export const LIBRARY_PAGE_SIZE = 24;

export const pageLibraryRows = <T>(
  rows: readonly T[],
  page: number,
  options: { pageSize?: number; rowsAlreadyOffset?: boolean } = {}
) => {
  const pageSize = options.pageSize ?? LIBRARY_PAGE_SIZE;
  const offset = options.rowsAlreadyOffset ? 0 : (page - 1) * pageSize;
  const pageWithSentinel = rows.slice(offset, offset + pageSize + 1);

  return {
    hasMore: pageWithSentinel.length > pageSize,
    items: pageWithSentinel.slice(0, pageSize),
  };
};
