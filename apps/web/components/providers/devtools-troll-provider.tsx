"use client";

import { DevtoolsTrollOverlay } from "@/components/devtools/devtools-troll-overlay";
import { setDevtoolsFetchBlocked } from "@/lib/api/devtools-fetch-guard";
import { cancelBrowserQueries } from "@/lib/query-client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const DETECT_DELAY_MS = 400;

const isDevtoolsTrapDisabled = (): boolean =>
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_DISABLE_DEVTOOLS_TRAP === "true" ||
  process.env.NEXT_PUBLIC_DISABLE_DEVTOOLS_TRAP === "1";

type DevtoolsTrollProviderProps = {
  children: ReactNode;
};

const DevtoolsTrollProviderInner = ({
  children,
}: DevtoolsTrollProviderProps) => {
  const pathname = usePathname();
  const enabled = !pathname.startsWith("/ffs");
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setDevtoolsFetchBlocked(false);
      setDevtoolsOpen(false);
      return;
    }

    let disposed = false;

    const onDevtoolsChange = (isOpen: boolean) => {
      setDevtoolsFetchBlocked(isOpen);
      if (isOpen) {
        cancelBrowserQueries();
      }
      setDevtoolsOpen(isOpen);
    };

    void import("devtools-detector")
      .then((module) => {
        if (disposed) return;

        const devtoolsDetector = new module.DevtoolsDetector({
          checkers: [
            module.checkers.workerPerformanceChecker,
            module.checkers.performanceChecker,
          ],
        });
        devtoolsDetector.setDetectDelay(DETECT_DELAY_MS);
        devtoolsDetector.addListener(onDevtoolsChange);
        devtoolsDetector.launch();

        cleanupRef.current = () => {
          devtoolsDetector.removeListener(onDevtoolsChange);
          devtoolsDetector.stop();
        };
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      setDevtoolsFetchBlocked(false);
    };
  }, [enabled]);

  return (
    <>
      {children}
      {enabled && devtoolsOpen ? <DevtoolsTrollOverlay /> : null}
    </>
  );
};

export function DevtoolsTrollProvider({
  children,
}: DevtoolsTrollProviderProps) {
  if (isDevtoolsTrapDisabled()) {
    return children;
  }

  return <DevtoolsTrollProviderInner>{children}</DevtoolsTrollProviderInner>;
}
