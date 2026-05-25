import { useState, useCallback } from "react";

interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  goTo: (p: number) => void;
  next: () => void;
  prev: () => void;
  setTotal: (total: number) => void;
  from: number;
  to: number;
}

export function usePagination(
  initialPage: number = 1,
  initialLimit: number = 20,
): PaginationResult {
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const limit = initialLimit;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const goTo = useCallback(
    (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    [totalPages],
  );

  const next = useCallback(() => {
    if (hasNext) setPage((p) => p + 1);
  }, [hasNext]);

  const prev = useCallback(() => {
    if (hasPrev) setPage((p) => p - 1);
  }, [hasPrev]);

  return { page, limit, total, totalPages, hasNext, hasPrev, goTo, next, prev, setTotal, from, to };
}
