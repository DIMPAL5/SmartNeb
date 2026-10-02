import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export function LoadingSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  const t = useT();
  return (
    <div className={cn("space-y-3", className)} role="status" aria-live="polite">
      <span className="sr-only">{t("patient.states.loadingData")}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div>
        <p className="font-display text-base font-semibold">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <p className="font-display text-base font-semibold">{t("patient.states.somethingWrong")}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {message ?? t("patient.states.couldNotLoad")}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 size-4" /> {t("action.retry")}
        </Button>
      ) : null}
    </div>
  );
}
