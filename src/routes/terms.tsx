import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";
import { REGISTRATION_FEE_KES } from "@/lib/constants";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions: Steve Safari" },
      { name: "description", content: "The terms that apply when you use the Steve Safari website and register for the programme." },
      { property: "og:title", content: "Terms and Conditions: Steve Safari" },
      { property: "og:description", content: "KES 500 is the only registration fee. Registration does not guarantee sponsorship, flights, visas or acceptance." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms and Conditions"
      sections={[
        { heading: "About these terms", body: <p>These terms apply to your use of the Steve Safari website and your registration with the Steve Safari programme. By clicking “I Agree &amp; Continue” or submitting a registration, you accept them.</p> },
        {
          heading: "Registration fee",
          body: (
            <>
              <p>The registration fee is <strong>KES {REGISTRATION_FEE_KES} only</strong>. It is a one-time, mandatory fee per applicant, paid through the M-Pesa prompt sent from this website.</p>
              <p>Steve Safari does not charge any other fee to register or to move between programme stages. If anyone asks you for additional payment in our name, do not pay and contact us immediately.</p>
              <p>The registration fee covers the administration and review of your application and is non-refundable once your application has been processed, except where required by law.</p>
            </>
          ),
        },
        {
          heading: "No guarantee of outcome",
          body: <p>Registration does <strong>not</strong> guarantee sponsorship, employment, flights, visas, work permits or acceptance into the programme. Employers and the relevant Canadian authorities make their own independent decisions.</p>,
        },
        { heading: "Accurate information", body: <p>You must provide true, complete and current information, including your legal name and national ID number. Applications with false or misleading information may be rejected or withdrawn.</p> },
        { heading: "Programme stages", body: <p>Applications move through these stages: Registered, Pending Approval, Approved, Sponsorship Approved, Waiting for Flight and Programme Alumni. An application may also be rejected or withdrawn. Our team decides stage changes based on eligibility and document review.</p> },
        { heading: "Public listings", body: <p>If you consent, your first name, last initial and county may appear on our public member lists. You may withdraw consent at any time by contacting us, and we will remove you from the public lists.</p> },
        { heading: "Communication", body: <p>We will contact you by email or phone about your application. Always confirm communications through the official contact details listed on this website.</p> },
        { heading: "Changes", body: <p>We may update these terms. When we do, we will change the version number shown above and ask you to accept the new version.</p> },
      ]}
    />
  );
}
