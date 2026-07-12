"use client";

import { Button } from "@/components/ui/button";
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
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <p className="text-sm text-white/70">Unsaved changes</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/15 bg-transparent"
            disabled={saving}
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !dirty}
            onClick={onSave}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
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
