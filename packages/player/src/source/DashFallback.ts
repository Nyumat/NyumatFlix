/**
 * Fallback resolver for MPEG-DASH manifests that Shaka Player refuses to load.
 *
 * Some valid-but-under-specified DASH manifests declare each Representation as a
 * single self-contained file via a bare <BaseURL>, with NO <SegmentBase>,
 * <SegmentList>, or <SegmentTemplate>. The DASH spec lets a player treat that
 * file as one segment and read its internal `sidx` index, which is exactly what
 * dash.js does — but Shaka is strict and skips every such Representation
 * ("Representation does not contain a segment information source"), failing the
 * whole load with DASH_EMPTY_PERIOD (4004).
 *
 * Those files are just ordinary (fragmented) MP4s, which the player's FFmpeg
 * demuxer reads natively. This module probes the manifest and, when it finds the
 * bare-BaseURL case, resolves the best video file URL plus (for demuxed content)
 * the separate audio file URL, so the caller can play them through the demuxer
 * (+ a native <audio> element for the split audio).
 *
 * Returns null when the manifest has proper segment info (so Shaka's failure was
 * for some other reason and this fallback wouldn't help).
 */

import { Logger } from "../utils/Logger";

const TAG = "DashFallback";

const AUDIO_CODEC_RE = /\b(mp4a|ac-3|ec-3|ac-4|opus|vorbis|flac|dtsc|dtse)\b/i;
const VIDEO_CODEC_RE = /\b(avc[13]|hvc1|hev1|vp0[89]|vp8|vp9|av01|dvh)/i;

export interface DashFallbackPlan {
  /** Single-file video (or muxed) Representation to feed the demuxer. */
  videoUrl: string;
  /** Separate audio file for demuxed content; omitted when muxed/audio-only. */
  audioUrl?: string;
}

/** Resolve a (possibly relative) URL against a base. */
function resolve(base: string, rel: string | null | undefined): string {
  if (!rel) return base;
  try {
    return new URL(rel, base).href;
  } catch {
    return base;
  }
}

/** First <BaseURL> text child of an element, if any. */
function baseUrlOf(el: Element | null): string | null {
  if (!el) return null;
  for (const child of Array.from(el.children)) {
    if (child.localName === "BaseURL") return child.textContent?.trim() || null;
  }
  return null;
}

/** A Representation is "bare" when it has a BaseURL but no segment addressing. */
function isBareRepresentation(rep: Element, adaptation: Element): boolean {
  if (!baseUrlOf(rep)) return false;
  const hasSegmentInfo = (el: Element) =>
    el.getElementsByTagName("SegmentTemplate").length > 0 ||
    el.getElementsByTagName("SegmentList").length > 0 ||
    el.getElementsByTagName("SegmentBase").length > 0;
  return !hasSegmentInfo(rep) && !hasSegmentInfo(adaptation);
}

function contentTypeOf(rep: Element, adaptation: Element): "audio" | "video" | "other" {
  const ct = (
    adaptation.getAttribute("contentType") ||
    rep.getAttribute("mimeType") ||
    adaptation.getAttribute("mimeType") ||
    ""
  ).toLowerCase();
  if (ct.includes("audio")) return "audio";
  if (ct.includes("video")) return "video";
  const codecs = rep.getAttribute("codecs") || adaptation.getAttribute("codecs") || "";
  if (VIDEO_CODEC_RE.test(codecs)) return "video";
  if (AUDIO_CODEC_RE.test(codecs)) return "audio";
  return "other";
}

/**
 * Probe a DASH manifest for the bare-BaseURL single-file case. Returns the video
 * (and any separate audio) file URLs, or null if it's not that case.
 */
export async function analyzeDashFallback(
  manifestUrl: string,
  headers?: Record<string, string>,
): Promise<DashFallbackPlan | null> {
  let xml: string;
  try {
    const res = await fetch(manifestUrl, { headers });
    if (!res.ok) return null;
    xml = await res.text();
  } catch (e) {
    Logger.warn(TAG, "Failed to fetch DASH manifest for fallback", e);
    return null;
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return null;
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  const mpd = doc.getElementsByTagName("MPD")[0];
  if (!mpd) return null;

  const mpdBase = resolve(manifestUrl, baseUrlOf(mpd));

  let bestVideo: { url: string; bw: number; muxed: boolean } | null = null;
  let bestAudio: { url: string; bw: number } | null = null;

  // First period only — these single-file manifests are single-period VOD.
  const period = mpd.getElementsByTagName("Period")[0];
  if (!period) return null;
  const periodBase = resolve(mpdBase, baseUrlOf(period));

  for (const adaptation of Array.from(period.getElementsByTagName("AdaptationSet"))) {
    const adaptationBase = resolve(periodBase, baseUrlOf(adaptation));
    for (const rep of Array.from(adaptation.getElementsByTagName("Representation"))) {
      if (!isBareRepresentation(rep, adaptation)) continue;
      const url = resolve(adaptationBase, baseUrlOf(rep));
      const bw = parseInt(rep.getAttribute("bandwidth") || "0", 10);
      const type = contentTypeOf(rep, adaptation);
      const codecs = rep.getAttribute("codecs") || adaptation.getAttribute("codecs") || "";
      const muxed = AUDIO_CODEC_RE.test(codecs) && VIDEO_CODEC_RE.test(codecs);

      if (type === "video") {
        if (!bestVideo || bw > bestVideo.bw) bestVideo = { url, bw, muxed };
      } else if (type === "audio") {
        if (!bestAudio || bw > bestAudio.bw) bestAudio = { url, bw };
      }
    }
  }

  // No bare-BaseURL Representations → Shaka failed for another reason.
  if (!bestVideo && !bestAudio) return null;

  // Audio-only manifest: play the audio file through the demuxer directly.
  if (!bestVideo && bestAudio) {
    Logger.info(TAG, `DASH fallback (audio-only) → ${bestAudio.url}`);
    return { videoUrl: bestAudio.url };
  }

  const plan: DashFallbackPlan = { videoUrl: bestVideo!.url };
  // Muxed file already carries audio; otherwise attach the separate audio file.
  if (!bestVideo!.muxed && bestAudio) plan.audioUrl = bestAudio.url;
  Logger.info(
    TAG,
    `DASH fallback → video=${plan.videoUrl}${plan.audioUrl ? `, audio=${plan.audioUrl}` : " (muxed)"}`,
  );
  return plan;
}
