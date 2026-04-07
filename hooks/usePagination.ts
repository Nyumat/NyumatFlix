"use client";

import { usePathname, useSearchParams } from "next/navigation";

export const usePagination = ({
  totalPages,
  currentPage,
}: {
  totalPages: number;
  currentPage: number;
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const numbers: (number | "ellipsis1" | "ellipsis2")[] = [];

  const startPage = Math.max(2, currentPage - 2);
  const endPage = Math.min(totalPages - 1, currentPage + 2);

  if (startPage > 2) {
    numbers.push(1, "ellipsis1");
  } else if (startPage === 2) {
    numbers.push(1);
  }

  for (let num = startPage; num <= endPage; num++) {
    numbers.push(num);
  }

  if (endPage < totalPages - 1) {
    numbers.push("ellipsis2", totalPages);
  } else if (endPage === totalPages - 1) {
    numbers.push(totalPages);
  }

  const setPage = (num: number) => {
    const search = new URLSearchParams(searchParams);
    search.set("page", num.toString());
    return `${pathname}?${search.toString()}`;
  };

  const pageLink = (page: string | number) => {
    return setPage(Number(page));
  };

  const prevLink = setPage(currentPage - 1);
  const nextLink = setPage(currentPage + 1);

  return {
    numbers,
    prevLink,
    nextLink,
    pageLink,
  };
};
