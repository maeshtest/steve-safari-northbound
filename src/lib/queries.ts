import { queryOptions } from "@tanstack/react-query";
import { getDirectory, getDirectoryCounts, getPublishedTestimonials, getSiteContent } from "@/lib/public.functions";
import type { DirectoryList } from "@/lib/constants";

export const siteContentQuery = queryOptions({
  queryKey: ["site-content"],
  queryFn: () => getSiteContent(),
  staleTime: 60_000,
});

export const directoryQuery = (list: DirectoryList) =>
  queryOptions({
    queryKey: ["directory", list],
    queryFn: () => getDirectory({ data: { list } }),
    staleTime: 30_000,
  });

export const directoryCountsQuery = queryOptions({
  queryKey: ["directory-counts"],
  queryFn: () => getDirectoryCounts(),
  staleTime: 30_000,
});

export const testimonialsQuery = queryOptions({
  queryKey: ["testimonials"],
  queryFn: () => getPublishedTestimonials(),
  staleTime: 30_000,
});
