import { describe, expect, it } from "vitest";
import { canApproveApplication } from "@/lib/application-approval";
import { hasExactlyOneApplicantIdentifier } from "@/lib/applicant-identifier";

describe("applicant access and approval rules", () => {
  it("accepts one status identifier and rejects both or neither", () => {
    expect(hasExactlyOneApplicantIdentifier("SS-26-AB12CD", undefined)).toBe(true);
    expect(hasExactlyOneApplicantIdentifier(undefined, "12345678")).toBe(true);
    expect(hasExactlyOneApplicantIdentifier("SS-26-AB12CD", "12345678")).toBe(false);
    expect(hasExactlyOneApplicantIdentifier(undefined, undefined)).toBe(false);
    expect(hasExactlyOneApplicantIdentifier("   ", undefined)).toBe(false);
  });

  it("allows approval only after the KES 500 fee is paid and the Zoom meeting is complete", () => {
    expect(canApproveApplication({ paymentStatus: "unpaid", zoomMeetingCompletedAt: "2026-11-24T13:00:00.000Z" })).toBe(false);
    expect(canApproveApplication({ paymentStatus: "paid", zoomMeetingCompletedAt: null })).toBe(false);
    expect(canApproveApplication({ paymentStatus: "paid", zoomMeetingCompletedAt: "2026-11-24T13:00:00.000Z" })).toBe(true);
  });
});