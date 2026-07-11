import { useEffect, useState } from "react";
import { isBrowser } from "@/lib/constants";

const getInitialState = (query: string, defaultState?: boolean) => {
  if (defaultState !== undefined) return defaultState;
  if (isBrowser) return window.matchMedia(query).matches;
  if (process.env.NODE_ENV !== "production")
    console.warn(
      "`useMedia` When server side rendering, defaultState should be defined to prevent hydration mismatches.",
    );
  return false;
};

const useMedia = (query: string, defaultState?: boolean) => {
  const [state, setState] = useState(getInitialState(query, defaultState));

  useEffect(() => {
    let mounted = true;
    const mql = window.matchMedia(query);
    const onChange = () => {
      if (!mounted) {
        return;
      }
      setState(!!mql.matches);
    };

    mql.addEventListener("change", onChange);
    setState(mql.matches);

    return () => {
      mounted = false;
      mql.removeEventListener("change", onChange);
    };
  }, [query]);

  return state;
};

export default useMedia;
