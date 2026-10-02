import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";

/** Time-of-day scheduler for nebulization care plans (HH:MM, 24h). */
export function TimeSlotsField({
  value,
  onChange,
  id = "care-plan-times",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");

  function add() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft)) return;
    if (value.includes(draft)) {
      setDraft("");
      return;
    }
    onChange([...value, draft].sort());
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("patient.timeSlots.label")}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="time"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft}>
          <Plus className="size-4" aria-hidden />
          <span className="sr-only">{t("patient.timeSlots.addAria")}</span>
        </Button>
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((slot) => (
            <li key={slot}>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full border bg-surface-2 px-3 py-1 text-xs font-medium"
                onClick={() => onChange(value.filter((x) => x !== slot))}
                aria-label={t("patient.timeSlots.removeAria", { time: slot })}
              >
                {slot}
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("patient.timeSlots.noneNote")}</p>
      )}
    </div>
  );
}
