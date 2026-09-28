"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { SettingsRow } from "@/components/ffs/settings/settings-row";

type SettingsCheckboxRowProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function SettingsCheckboxRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: SettingsCheckboxRowProps) {
  return (
    <SettingsRow
      label={label}
      description={description}
      control={
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={label}
        />
      }
    />
  );
}
