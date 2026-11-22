import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/components/site/DirectoryPage";
import { directoryQuery } from "@/lib/queries";

export const Route = createFileRoute("/sponsorship")({
  head: () => ({
    meta: [
      { title: "Approved Sponsorship List — Steve Safari" },
      { name: "description", content: "Members whose sponsorship for work in Canada has been approved." },
      { property: "og:title", content: "Approved Sponsorship List — Steve Safari" },
      { property: "og:description", content: "Members whose sponsorship for work in Canada has been approved." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(directoryQuery("sponsorship")),
  component: () => <DirectoryPage list="sponsorship" eyebrow="Sponsorship" title="Approved Sponsorship List" intro="Members whose sponsorship for work in Canada has been approved." />,
});
