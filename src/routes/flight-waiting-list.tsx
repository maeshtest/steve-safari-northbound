import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/components/site/DirectoryPage";
import { directoryQuery } from "@/lib/queries";

export const Route = createFileRoute("/flight-waiting-list")({
  head: () => ({
    meta: [
      { title: "Flight Waiting List: Steve Safari" },
      { name: "description", content: "Members with confirmed sponsorship who are waiting for their flight to Canada." },
      { property: "og:title", content: "Flight Waiting List: Steve Safari" },
      { property: "og:description", content: "Members with confirmed sponsorship who are waiting for their flight to Canada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(directoryQuery("flight")),
  component: () => <DirectoryPage list="flight" eyebrow="Travel preparation" title="Flight Waiting List" intro="Members with confirmed sponsorship who are waiting for their flight to Canada." />,
});
