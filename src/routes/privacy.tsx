import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Steve Safari" },
      { name: "description", content: "How Steve Safari collects, uses and protects your personal information." },
      { property: "og:title", content: "Privacy Policy — Steve Safari" },
      { property: "og:description", content: "Your ID number, phone, email and documents are never published." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      sections={[
        { heading: "What we collect", body: <p>Your full name, national ID number, phone number, email address, county, any supporting documents you upload, your M-Pesa payment details and the date you accepted our terms.</p> },
        { heading: "Why we collect it", body: <p>To process and review your application, verify your registration payment, contact you about your application, and consider you for sponsorship opportunities.</p> },
        {
          heading: "What is public",
          body: <p>Only if you give consent, we show your first name, last initial and county on our public member lists. We <strong>never</strong> publish national ID numbers, phone numbers, email addresses, uploaded documents or internal notes.</p>,
        },
        { heading: "How we protect it", body: <p>Your information is stored securely and only authorised Steve Safari administrators can see it. Documents are stored privately and opened only through short-lived secure links. Payment credentials are encrypted.</p> },
        { heading: "Sharing", body: <p>We share information only where needed to process your application, such as with prospective sponsors, or where the law requires it. We do not sell your information.</p> },
        { heading: "Your rights", body: <p>You may ask to see, correct or delete your information, or withdraw consent to public listing, by contacting us through the details on our Contact page. These rights are provided under the Kenya Data Protection Act, 2019.</p> },
        { heading: "Retention", body: <p>We keep application records for as long as needed to run the programme and meet legal obligations, then delete them securely.</p> },
      ]}
    />
  );
}
