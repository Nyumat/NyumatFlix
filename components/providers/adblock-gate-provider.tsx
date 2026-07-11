"use client";

import AdblockerAlert from "@/components/content/adblocker-alert";
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
  const [alertSession, setAlertSession] = useState(0);
  const [openSignal, setOpenSignal] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const gateAction = useCallback<GateAction>(
    (action) => {
      if (adBlockDetected || hasDismissedAdblockPrompt()) {
        action();
        return;
      }

      pendingActionRef.current = action;
      setAlertSession((session) => session + 1);
      setOpenSignal(true);
    },
    [adBlockDetected],
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
