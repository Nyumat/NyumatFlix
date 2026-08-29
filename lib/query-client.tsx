"use client";

import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type ReactNode, useEffect, useState } from "react";
import { queryGcTime, queryStaleTime, IS_DEV } from "./cache-policy";
import { createIDBPersister } from "./idb-persister";

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24;
const DEFAULT_STALE_MS = 5 * 60 * 1000;

const PERSIST_BUSTER = "v2";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: queryStaleTime(DEFAULT_STALE_MS),
        gcTime: queryGcTime(TWENTY_FOUR_HOURS),
        retry: 1,
        refetchOnWindowFocus: IS_DEV,
        refetchOnMount: IS_DEV ? "always" : true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;
let persister: ReturnType<typeof createIDBPersister> | undefined = undefined;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

function getPersister() {
  if (isServer || IS_DEV) return undefined;
  if (!persister) persister = createIDBPersister();
  return persister;
}

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const queryClient = getQueryClient();
  const idbPersister = getPersister();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (IS_DEV) {
      void createIDBPersister().removeClient();
    }
  }, []);

  if (!idbPersister) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: TWENTY_FOUR_HOURS,
        buster: PERSIST_BUSTER,
      }}
    >
      {children}
      {isMounted && (
        <ReactQueryDevtools
          hideDisabledQueries={true}
          theme="dark"
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )}
    </PersistQueryClientProvider>
  );
}
