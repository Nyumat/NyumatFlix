"use client";

import { DevtoolsTrollOverlay } from "@/components/devtools/devtools-troll-overlay";
import { setDevtoolsFetchBlocked } from "@/lib/api/devtools-fetch-guard";
import { cancelBrowserQueries } from "@/lib/query-client";
import { DevtoolsDetector, checkers } from "devtools-detector";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const DETECT_DELAY_MS = 400;

const isDevtoolsTrapDisabled = (): boolean =>
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_DISABLE_DEVTOOLS_TRAP === "true" ||
  process.env.NEXT_PUBLIC_DISABLE_DEVTOOLS_TRAP === "1";

const devtoolsDetector = new DevtoolsDetector({
  checkers: [checkers.workerPerformanceChecker, checkers.performanceChecker],
});

type DevtoolsTrollProviderProps = {
  children: ReactNode;
};

const DevtoolsTrollProviderInner = ({
  children,
}: DevtoolsTrollProviderProps) => {
  const pathname = usePathname();
  const enabled = !pathname.startsWith("/ffs");
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDevtoolsFetchBlocked(false);
      setDevtoolsOpen(false);
      return;
    }

    const onDevtoolsChange = (isOpen: boolean) => {
      setDevtoolsFetchBlocked(isOpen);
      if (isOpen) {
        cancelBrowserQueries();
      }
      setDevtoolsOpen(isOpen);
    };

    devtoolsDetector.setDetectDelay(DETECT_DELAY_MS);
    devtoolsDetector.addListener(onDevtoolsChange);
    devtoolsDetector.launch();

    return () => {
      devtoolsDetector.removeListener(onDevtoolsChange);
      devtoolsDetector.stop();
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
