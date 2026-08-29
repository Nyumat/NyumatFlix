"use client";

import AdblockerAlert from "@/components/content/adblocker-alert";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { shouldBypassEmbedAdblockPrompt } from "@/lib/playback/embed-adblock-prompt";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { useServerStore } from "@/lib/stores/server-store";
import { useDetectAdBlock } from "adblock-detect-react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type GateAction = (action: () => void) => void;

const ADBLOCK_PROMPT_DISMISSED_KEY = "nyumatflix:adblock-prompt-dismissed";

const hasDismissedAdblockPrompt = () => {
  try {
    return localStorage.getItem(ADBLOCK_PROMPT_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
};

const rememberAdblockPromptDismissal = () => {
  try {
    localStorage.setItem(ADBLOCK_PROMPT_DISMISSED_KEY, "true");
  } catch {
    void 0;
  }
};

const AdblockGateContext = createContext<GateAction | null>(null);

export function useAdblockGateAction(): GateAction {
  const gateAction = useContext(AdblockGateContext);
  if (!gateAction) {
    throw new Error(
      "useAdblockGateAction must be used within AdblockGateProvider",
    );
  }
  return gateAction;
}

interface AdblockGateProviderProps {
  children: ReactNode;
}

export function AdblockGateProvider({ children }: AdblockGateProviderProps) {
  const adBlockDetected = useDetectAdBlock();
  const flags = useFeatureFlags();
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const selectedServer = useServerStore((state) => state.selectedServer);
  const [alertSession, setAlertSession] = useState(0);
  const [openSignal, setOpenSignal] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const gateAction = useCallback<GateAction>(
    (action) => {
      if (
        adBlockDetected ||
        hasDismissedAdblockPrompt() ||
        shouldBypassEmbedAdblockPrompt({
          noAdsMode,
          flags,
          selectedServer,
        })
      ) {
        action();
        return;
      }

      pendingActionRef.current = action;
      setAlertSession((session) => session + 1);
      setOpenSignal(true);
    },
    [adBlockDetected, flags, noAdsMode, selectedServer],
  );

  const handleProceed = useCallback(() => {
    rememberAdblockPromptDismissal();
    setOpenSignal(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  return (
    <AdblockGateContext.Provider value={gateAction}>
      {children}
      <AdblockerAlert
        key={alertSession}
        openSignal={openSignal}
        onProceed={handleProceed}
      />
    </AdblockGateContext.Provider>
  );
}
