import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/components/site/DirectoryPage";
import { directoryQuery } from "@/lib/queries";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Registered Members: Steve Safari" },
      { name: "description", content: "Members who have completed registration with Steve Safari and agreed to be listed publicly." },
      { property: "og:title", content: "Registered Members: Steve Safari" },
      { property: "og:description", content: "Members who have completed registration with Steve Safari and agreed to be listed publicly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(directoryQuery("members")),
  component: () => <DirectoryPage list="members" eyebrow="Member directory" title="Registered Members" intro="Members who have completed registration with Steve Safari and agreed to be listed publicly." />,
});
