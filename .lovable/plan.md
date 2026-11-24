# Applicant continuation and Vercel bridge

## User-facing changes
- Let applicants check their status with either a reference number or national ID, never both. Return only the minimal status details.
- When a registration uses an existing national ID, send the applicant to that application instead of creating a duplicate.
- After the KES 500 payment, tell applicants the Steve Safari team will contact them to arrange a Zoom meeting before approval. Let staff record completion, and prevent approval until payment and the meeting are complete.
- Add editable support contact details to Admin Settings and keep the public contact page in sync.
- Complete the direct-on-Lovable / bridged-on-Vercel flows for registration, status, contact submissions, PayHero STK and callbacks, transactional email, and public content. Keep provider and database secrets on the primary Lovable deployment.

## Technical approach
- Use the existing `HL_SERVER_KEY` generation and `bridge_ok` validation; Vercel forwards server-side requests to the stable Lovable app endpoint, so no Vercel service-role key or bridge URL variable is needed.
- Add an application Zoom-completion timestamp and a database trigger that blocks transitions into approved stages until the KES 500 fee is paid and Zoom completion is recorded.
- Preserve direct privileged execution on Lovable; proxy only when the host has no service key. Validate bridge inputs and return minimal applicant data.
- Update stage/status copy and the existing payment-confirmation email. Keep meeting scheduling external: the team contacts applicants by email or phone, with no invented Zoom link or appointment time.

## Verification
- Add focused tests for one-identifier status lookup and the approval gate.
- Check the preview build, applicant status and duplicate-registration path, bridge authorization, and responsive status page. Do not create fake registrations or payments in the live database.