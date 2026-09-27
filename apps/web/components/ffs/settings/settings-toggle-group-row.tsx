"use client";

import { SettingsRow } from "@/components/ffs/settings/settings-row";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ToggleOption<T extends string> = {
  value: T;
  label: string;
};

type SettingsToggleGroupRowProps<T extends string> = {
  label: string;
  description?: string;
  value: T;
  options: ToggleOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
};

export function SettingsToggleGroupRow<T extends string>({
  label,
  description,
  value,
  options,
  onValueChange,
  disabled,
}: SettingsToggleGroupRowProps<T>) {
  return (
    <SettingsRow
      label={label}
      description={description}
      control={
        <ToggleGroup
          type="single"
          variant="quiet"
          size="sm"
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            if (next) onValueChange(next as T);
          }}
          className="flex-wrap justify-end"
        >
          {options.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              aria-label={option.label}
              className="h-8 px-2.5 text-xs"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    />
  );
}
