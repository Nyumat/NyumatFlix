"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import type {
  PlaybackAudioPreference,
  PlaybackQualityPreference,
} from "@/lib/playback/playback-preferences";
import { cn } from "@/lib/utils";
import { Captions } from "lucide-react";

function PreferenceOptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                isActive
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/25",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PlaybackPreferencesPanel() {
  const playbackAudio = useAppSettingsStore((state) => state.playbackAudio);
  const playbackQuality = useAppSettingsStore((state) => state.playbackQuality);
  const playbackEnglishSubtitles = useAppSettingsStore(
    (state) => state.playbackEnglishSubtitles,
  );
  const setPlaybackAudio = useAppSettingsStore(
    (state) => state.setPlaybackAudio,
  );
  const setPlaybackQuality = useAppSettingsStore(
    (state) => state.setPlaybackQuality,
  );
  const setPlaybackEnglishSubtitles = useAppSettingsStore(
    (state) => state.setPlaybackEnglishSubtitles,
  );

  return (
    <div className="space-y-4">
      <PreferenceOptionGroup<PlaybackAudioPreference>
        label="Audio"
        value={playbackAudio}
        options={[
          { value: "sub", label: "Japanese (sub)" },
          { value: "dub", label: "English (dub)" },
        ]}
        onChange={setPlaybackAudio}
      />

      <PreferenceOptionGroup<PlaybackQualityPreference>
        label="Resolution"
        value={playbackQuality}
        options={[
          { value: "1080p", label: "1080p" },
          { value: "720p", label: "720p" },
          { value: "480p", label: "480p" },
        ]}
        onChange={setPlaybackQuality}
      />

      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/15 px-3 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <Captions
            className="mt-0.5 size-4 shrink-0 text-zinc-300"
            strokeWidth={1.65}
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              English subtitles
            </p>
            <p className="text-xs text-zinc-400">
              Favor sources with English subs and turn them on when available
            </p>
          </div>
        </div>
        <Switch
          checked={playbackEnglishSubtitles}
          onCheckedChange={setPlaybackEnglishSubtitles}
          aria-label="English subtitles"
        />
      </div>
    </div>
  );
}
