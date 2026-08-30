import { useCallback, useSyncExternalStore } from "react";

const useMedia = (query: string, defaultState?: boolean) => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  const getServerSnapshot = useCallback(() => {
    if (defaultState !== undefined) {
      return defaultState;
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "`useMedia` When server side rendering, defaultState should be defined to prevent hydration mismatches.",
      );
    }

    return false;
  }, [defaultState]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

export default useMedia;
