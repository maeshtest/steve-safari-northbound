ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS zoom_meeting_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.require_zoom_before_application_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage
     AND NEW.stage IN ('approved'::public.member_stage, 'sponsorship_approved'::public.member_stage) THEN
    IF NEW.payment_status IS DISTINCT FROM 'paid'::public.payment_state THEN
      RAISE EXCEPTION 'The KES 500 registration fee must be confirmed before approval.';
    END IF;
    IF NEW.zoom_meeting_completed_at IS NULL THEN
      RAISE EXCEPTION 'Record the required Zoom meeting before approval.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER applications_zoom_approval_gate
  BEFORE UPDATE OF stage ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.require_zoom_before_application_approval();