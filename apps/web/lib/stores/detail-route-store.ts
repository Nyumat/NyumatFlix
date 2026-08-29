import { create } from "zustand";

type DetailRouteMetadata = {
  pathname: string;
  parentRoute?: string;
};

type DetailRouteStoreState = {
  metadata: DetailRouteMetadata | null;
  setDetailRouteMetadata: (metadata: DetailRouteMetadata) => void;
  clearDetailRouteMetadata: (pathname?: string) => void;
  getParentRouteOverride: (pathname: string) => string | undefined;
};

export const useDetailRouteStore = create<DetailRouteStoreState>(
  (set, get) => ({
    metadata: null,
    setDetailRouteMetadata: (metadata) => set({ metadata }),
    clearDetailRouteMetadata: (pathname) =>
      set((state) => {
        if (pathname && state.metadata?.pathname !== pathname) return state;
        return { metadata: null };
      }),
    getParentRouteOverride: (pathname) => {
      const metadata = get().metadata;
      return metadata?.pathname === pathname ? metadata.parentRoute : undefined;
    },
  }),
);

export const useDetailRouteParentOverride = (pathname: string) =>
  useDetailRouteStore((state) =>
    state.metadata?.pathname === pathname
      ? state.metadata.parentRoute
      : undefined,
  );
