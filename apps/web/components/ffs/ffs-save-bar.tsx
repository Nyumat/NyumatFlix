"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type FfsSaveBarProps = {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
};

export function FfsSaveBar({
  dirty,
  saving,
  onSave,
  onReset,
}: FfsSaveBarProps) {
  if (!dirty && !saving) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Unsaved changes</p>
          {saving ? (
            <Badge variant="outline" className="text-[11px]">
              Saving
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-border bg-transparent shadow-none"
            disabled={saving}
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !dirty}
            className="h-8 bg-foreground text-background shadow-none hover:bg-foreground/90"
            onClick={onSave}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
