export function canApproveApplication(input: {
  paymentStatus: string;
  zoomMeetingCompletedAt: string | null;
}): boolean {
  return input.paymentStatus === "paid" && input.zoomMeetingCompletedAt !== null;
}