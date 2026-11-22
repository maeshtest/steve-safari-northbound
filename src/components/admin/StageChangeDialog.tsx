import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_EMAIL_TEMPLATE, STAGE_LABELS, STAGE_ORDER, type MemberStage } from "@/lib/constants";

export function StageChangeDialog({
  open,
  onOpenChange,
  count,
  initialStage,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  initialStage?: MemberStage;
  onConfirm: (stage: MemberStage, note: string, notify: boolean) => Promise<void>;
}) {
  const [stage, setStage] = useState<MemberStage>(initialStage ?? "approved");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const hasTemplate = Boolean(STAGE_EMAIL_TEMPLATE[stage]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change stage</DialogTitle>
          <DialogDescription>{count === 1 ? "Move this application to a new stage." : `Move ${count} applications to a new stage.`} Every change is recorded in the audit trail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as MemberStage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage-note">Note (internal{stage === "rejected" ? ", also included in the rejection email" : ""})</Label>
            <Textarea id="stage-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {hasTemplate && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} /> Email the applicant about this change
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(stage, note, hasTemplate && notify);
                setNote("");
                onOpenChange(false);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
