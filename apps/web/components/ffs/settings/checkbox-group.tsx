"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CheckboxGroupItem = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

type CheckboxGroupProps = {
  items: CheckboxGroupItem[];
  onEnableAll?: () => void;
  onDisableAll?: () => void;
  className?: string;
  columns?: 2 | 3;
};

export function CheckboxGroup({
  items,
  onEnableAll,
  onDisableAll,
  className,
  columns = 2,
}: CheckboxGroupProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {onEnableAll || onDisableAll ? (
        <div className="flex items-center justify-end gap-3 text-xs">
          {onEnableAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onEnableAll}
            >
              Enable all
            </Button>
          ) : null}
          {onDisableAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onDisableAll}
            >
              Disable all
            </Button>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "grid gap-x-6 gap-y-2",
          columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 py-1">
            <Checkbox
              id={item.id}
              checked={item.checked}
              disabled={item.disabled}
              onCheckedChange={(value) => item.onCheckedChange(value === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor={item.id}
              className="min-w-0 cursor-pointer space-y-0.5 font-normal leading-snug"
            >
              <span className="text-sm text-foreground">{item.label}</span>
              {item.hint ? (
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {item.hint}
                </span>
              ) : null}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
