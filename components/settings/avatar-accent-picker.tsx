"use client";

import {
  AVATAR_ACCENT_PRESETS,
  DEFAULT_AVATAR_ACCENT,
  normalizeAccentHex,
} from "@/lib/user/avatar";
import { cn } from "@/lib/utils";

interface AvatarAccentPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function AvatarAccentPicker({
  value,
  onChange,
}: AvatarAccentPickerProps) {
  const normalized = normalizeAccentHex(value) ?? DEFAULT_AVATAR_ACCENT;
  const isCustomAccent = !AVATAR_ACCENT_PRESETS.some(
    (preset) => preset.hex === normalized,
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {AVATAR_ACCENT_PRESETS.map((preset) => {
          const isSelected = normalized === preset.hex;
          return (
            <button
              key={preset.hex}
              type="button"
              aria-label={preset.label}
              aria-pressed={isSelected}
              title={preset.label}
              onClick={() => onChange(preset.hex)}
              className={cn(
                "size-7 rounded-full border transition",
                isSelected
                  ? "border-white/80 ring-2 ring-white/35 ring-offset-2 ring-offset-black/60"
                  : "border-white/15 hover:border-white/35",
              )}
              style={{ backgroundColor: `#${preset.hex}` }}
            />
          );
        })}

        <label
          title="Custom accent"
          className={cn(
            "relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-white/20 bg-black/30 text-[11px] font-medium text-zinc-400 transition hover:border-white/35 hover:text-zinc-200",
            isCustomAccent &&
              "border-white/70 ring-2 ring-white/35 ring-offset-2 ring-offset-black/60",
          )}
        >
          <span className="pointer-events-none">+</span>
          <input
            type="color"
            value={`#${normalized}`}
            onChange={(event) => {
              const next = normalizeAccentHex(event.target.value);
              if (next) {
                onChange(next);
              }
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Custom accent color"
          />
        </label>
      </div>

      <p className="text-[11px] text-zinc-500">
        Accent <span className="font-mono text-zinc-400">#{normalized}</span>
      </p>
    </div>
  );
}
