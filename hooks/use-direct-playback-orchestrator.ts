"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  classifyStreamFailure,
  findNextViableStream,
  streamAdvanceNote,
  type EngineErrorKind,
  type PlaybackFailureReason,
} from "@/lib/direct/playbackFailure";
import {
  engineSourceUrl,
  nextFallbackEngine,
  playbackEngineLabel,
  selectInitialEngine,
  shouldRetainMoviEngine,
  type DirectPlaybackEngine,
} from "@/lib/direct/playback";
import { prefetchMoviMediaBytes } from "@/lib/movi/prefetch-movi-media";
import { streamIdentity } from "@/lib/direct/streamUtils";
import type { DirectStream } from "@/lib/direct/types";

type UseDirectPlaybackOrchestratorOptions = {
  stream: DirectStream;
  candidates?: DirectStream[];
  onReady?: (stream: DirectStream) => void;
  onExhausted?: () => void;
};

export function useDirectPlaybackOrchestrator({
  stream,
  candidates,
  onReady,
  onExhausted,
}: UseDirectPlaybackOrchestratorOptions) {
  const onExhaustedRef = useRef(onExhausted);
  onExhaustedRef.current = onExhausted;
  const candidateList = candidates?.length ? candidates : [stream];
  const candidateListRef = useRef(candidateList);
  candidateListRef.current = candidateList;

  const [activeStream, setActiveStream] = useState(stream);
  const [engine, setEngine] = useState<DirectPlaybackEngine | null>(() =>
    selectInitialEngine(stream),
  );
  const [failed, setFailed] = useState(
    () => selectInitialEngine(stream) === null,
  );
  const [failureReason, setFailureReason] =
    useState<PlaybackFailureReason | null>(() =>
      selectInitialEngine(stream) === null ? "no_engine" : null,
    );
  const [buffering, setBuffering] = useState(true);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
  const [engineLabel, setEngineLabel] = useState<string>(() => {
    const initial = selectInitialEngine(stream);
    return initial
      ? playbackEngineLabel(initial, engineSourceUrl(stream, initial))
      : "Unavailable";
  });

  const triedEnginesRef = useRef<Set<DirectPlaybackEngine>>(new Set());
  const triedStreamsRef = useRef<Set<string>>(
    new Set([streamIdentity(stream)]),
  );
  const advancingRef = useRef(false);
  const readyReportedRef = useRef(false);
  const lastErrorKindRef = useRef<EngineErrorKind>("error");
  const activeStreamRef = useRef(activeStream);
  activeStreamRef.current = activeStream;

  const exhaustActiveStream = useCallback(
    async (lastEngine: DirectPlaybackEngine | null) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      setFailed(false);
      setBuffering(true);

      const current = activeStreamRef.current;
      const reason = await classifyStreamFailure(
        current,
        lastEngine,
        lastErrorKindRef.current,
      );

      const next = await findNextViableStream(
        candidateListRef.current,
        triedStreamsRef.current,
      );

      if (next.kind === "stream") {
        triedStreamsRef.current.add(streamIdentity(next.stream));
        setStatusNote(streamAdvanceNote(reason, next.stream.name));
        setFailureReason(null);
        setFailed(false);
        setActiveStream(next.stream);
        advancingRef.current = false;
        return;
      }

      if (lastErrorKindRef.current === "timeout") {
        triedEnginesRef.current = new Set();
        const initial = selectInitialEngine(current);
        readyReportedRef.current = false;
        setStatusNote("Still starting…");
        setFailureReason(null);
        setFailed(false);
        setBuffering(true);
        setPlaybackAttempt((attempt) => attempt + 1);
        setEngine(initial);
        setEngineLabel(
          initial
            ? playbackEngineLabel(initial, engineSourceUrl(current, initial))
            : "Unavailable",
        );
        advancingRef.current = false;
        return;
      }

      const finalReason =
        triedStreamsRef.current.size > 1 ? next.reason : reason;
      setFailureReason(finalReason);
      setFailed(true);
      setBuffering(false);
      setStatusNote(null);
      advancingRef.current = false;
      onExhaustedRef.current?.();
    },
    [],
  );

  useEffect(() => {
    setActiveStream(stream);
    triedStreamsRef.current = new Set([streamIdentity(stream)]);
    advancingRef.current = false;
    setStatusNote(null);
    setFailureReason(selectInitialEngine(stream) === null ? "no_engine" : null);
  }, [stream]);

  useEffect(() => {
    triedEnginesRef.current = new Set();
    const initial = selectInitialEngine(activeStream);
    setEngine(initial);
    setFailed(initial === null);
    setBuffering(true);
    setEngineLabel(
      initial
        ? playbackEngineLabel(initial, engineSourceUrl(activeStream, initial))
        : "Unavailable",
    );
    readyReportedRef.current = false;
    lastErrorKindRef.current = "error";
    setPlaybackAttempt(0);
    if (initial === null) {
      void exhaustActiveStream(null);
    }
  }, [activeStream, exhaustActiveStream]);

  useEffect(() => {
    if (!activeStream.fallbackUrl) return;
    if (shouldRetainMoviEngine(activeStream)) return;
    void fetch(activeStream.fallbackUrl).catch(() => undefined);
  }, [activeStream]);

  useEffect(() => {
    if (engine !== "movi") return;
    prefetchMoviMediaBytes(engineSourceUrl(activeStream, "movi"));
  }, [activeStream, engine]);

  const handleEngineReady = useCallback(() => {
    setBuffering(false);
    setStatusNote(null);
    if (readyReportedRef.current) return;
    readyReportedRef.current = true;
    onReady?.(activeStream);
  }, [activeStream, onReady]);

  const handleEngineError = useCallback(
    (detail?: { kind?: EngineErrorKind }) => {
      if (detail?.kind) {
        lastErrorKindRef.current = detail.kind;
      }
      if (!engine) {
        void exhaustActiveStream(null);
        return;
      }
      triedEnginesRef.current.add(engine);
      const fallback = nextFallbackEngine(
        activeStream,
        engine,
        triedEnginesRef.current,
      );
      if (fallback) {
        const label = playbackEngineLabel(
          fallback,
          engineSourceUrl(activeStream, fallback),
        );
        setStatusNote(`Trying ${label}…`);
        setEngine(fallback);
        setEngineLabel(label);
        setBuffering(true);
        return;
      }
      void exhaustActiveStream(engine);
    },
    [activeStream, engine, exhaustActiveStream],
  );

  return {
    activeStream,
    engine,
    failed,
    failureReason,
    buffering,
    statusNote,
    engineLabel,
    playbackAttempt,
    triedStreamsCount: triedStreamsRef.current.size,
    handleEngineReady,
    handleEngineError,
  };
}
