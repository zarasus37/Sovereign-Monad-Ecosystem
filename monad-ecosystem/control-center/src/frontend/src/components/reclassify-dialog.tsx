/**
 * ReclassifyDialog — interactive single-event decision editor.
 *
 * Lets an analyst mark an event as approved, rejected, reclassified to
 * a specific class id, or escalated. Decisions persist to localStorage
 * via the HRDecisionStore so they survive reloads.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  type HRDecision,
  type DecisionKind,
  useHRDecisionStore,
} from "@/hooks/use-logoc";

interface ReclassifyDialogProps {
  /** The event id to decide on, or null to keep dialog closed. */
  eventId: string | null;
  /** Display info for the dialog header. */
  eventSummary?: string;
  /** Current Peirce class (for context / reclassify default). */
  currentClassId?: number | null;
  /** Called when the dialog closes for any reason. */
  onClose: () => void;
}

const DECISION_KINDS: Array<{ value: DecisionKind; label: string; description: string }> = [
  { value: "approved", label: "Approve", description: "Confirm the current class is correct" },
  { value: "reclassify", label: "Reclassify", description: "Change the event's sign class" },
  { value: "rejected", label: "Reject", description: "Mark the event as not a valid gnosis event" },
  { value: "escalated", label: "Escalate", description: "Send to senior reviewer (no class change)" },
];

export function ReclassifyDialog({
  eventId,
  eventSummary,
  currentClassId,
  onClose,
}: ReclassifyDialogProps) {
  const decisions = useHRDecisionStore((s) => s.byId);
  const setDecision = useHRDecisionStore((s) => s.set);
  const clearDecision = useHRDecisionStore((s) => s.clear);

  const existing: HRDecision | undefined = eventId ? decisions[eventId] : undefined;

  const [kind, setKind] = useState<DecisionKind>(existing?.kind ?? "approved");
  const [newClassId, setNewClassId] = useState<string>(
    existing?.newClassId !== undefined ? String(existing.newClassId) : ""
  );
  const [note, setNote] = useState(existing?.note ?? "");

  // Reset internal state when the target event changes
  useEffect(() => {
    if (existing) {
      setKind(existing.kind);
      setNewClassId(existing.newClassId !== undefined ? String(existing.newClassId) : "");
      setNote(existing.note ?? "");
    } else {
      setKind("approved");
      setNewClassId("");
      setNote("");
    }
  }, [eventId, existing]);

  const isOpen = eventId !== null;
  const isReclassify = kind === "reclassify";
  const newClassIdNum = Number(newClassId);
  const newClassIdValid = !isReclassify || Number.isInteger(newClassIdNum) && newClassIdNum >= 0 && newClassIdNum <= 65;
  const canSave = !!eventId && newClassIdValid && (isReclassify ? newClassIdNum !== currentClassId : true);

  function handleSave() {
    if (!eventId) return;
    const decision: HRDecision = {
      eventId,
      kind,
      decidedAt: new Date().toISOString(),
      ...(isReclassify ? { newClassId: newClassIdNum } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    setDecision(decision);
    onClose();
  }

  function handleClear() {
    if (!eventId) return;
    clearDecision(eventId);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-ocid="logoc.reclassify.dialog">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono tracking-widest uppercase">
            Review Event
          </DialogTitle>
          <DialogDescription className="text-[11px] font-mono break-all">
            {eventId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {eventSummary && (
            <div className="text-[11px] text-muted-foreground line-clamp-3 p-2 bg-muted/30 rounded border border-border/50">
              {eventSummary}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-muted-foreground uppercase">Decision</label>
            <Select value={kind} onValueChange={(v) => setKind(v as DecisionKind)}>
              <SelectTrigger className="h-8 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECISION_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    <span className="font-mono">{k.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{k.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isReclassify && (
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">
                New Class ID
                {currentClassId !== undefined && currentClassId !== null && (
                  <span className="ml-2">(current: {currentClassId})</span>
                )}
              </label>
              <Input
                type="number"
                min={0}
                max={65}
                placeholder="0-65"
                className="h-8 text-xs font-mono"
                value={newClassId}
                onChange={(e) => setNewClassId(e.target.value)}
                data-ocid="logoc.reclassify.class_input"
              />
              {newClassId !== "" && !newClassIdValid && (
                <p className="text-[10px] text-destructive font-mono">
                  Class ID must be an integer 0-65.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-muted-foreground uppercase">
              Note (optional)
            </label>
            <Input
              placeholder="Why this decision?"
              className="h-8 text-xs font-mono"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-ocid="logoc.reclassify.note_input"
            />
          </div>

          {existing && (
            <div className="text-[10px] font-mono text-muted-foreground border-t border-border/50 pt-2">
              Previously decided {new Date(existing.decidedAt).toLocaleString()}
              {existing.newClassId !== undefined && ` → class ${existing.newClassId}`}
              {existing.note && `: "${existing.note}"`}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {existing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 text-[10px] font-mono text-destructive"
              data-ocid="logoc.reclassify.clear_button"
            >
              Clear decision
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 text-[10px] font-mono"
            data-ocid="logoc.reclassify.cancel_button"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSave}
            className="h-7 text-[10px] font-mono"
            data-ocid="logoc.reclassify.save_button"
          >
            Save decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
