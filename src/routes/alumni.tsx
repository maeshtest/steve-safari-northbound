import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/components/site/DirectoryPage";
import { directoryQuery } from "@/lib/queries";

export const Route = createFileRoute("/alumni")({
  head: () => ({
    meta: [
      { title: "Programme Alumni: Steve Safari" },
      { name: "description", content: "Members who have completed the Steve Safari programme." },
      { property: "og:title", content: "Programme Alumni: Steve Safari" },
      { property: "og:description", content: "Members who have completed the Steve Safari programme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(directoryQuery("alumni")),
  component: () => <DirectoryPage list="alumni" eyebrow="Alumni" title="Programme Alumni" intro="Members who have completed the Steve Safari programme." />,
});
