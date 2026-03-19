export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

export interface PaginationOptions {
  limit?: number | null;
  offset?: number | null;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface NormalizedPagination {
  limit: number;
  offset: number;
}

export function normalizePagination(
  options: PaginationOptions = {},
): NormalizedPagination {
  const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_PAGE_LIMIT;
  const rawLimit = options.limit ?? defaultLimit;
  const rawOffset = options.offset ?? 0;

  return {
    limit: Math.min(Math.max(Math.trunc(rawLimit), 1), maxLimit),
    offset: Math.max(Math.trunc(rawOffset), 0),
  };
}
