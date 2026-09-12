"use client";

import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";
import { cache } from "react";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type ReactNode, useEffect } from "react";
import { queryGcTime, queryStaleTime, IS_DEV } from "./cache-policy";
import { createIDBPersister } from "./idb-persister";

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24;
const CATALOG_STALE_MS = 10 * 60 * 1000;

const PERSIST_BUSTER = "v2";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: queryStaleTime(CATALOG_STALE_MS),
        gcTime: queryGcTime(TWENTY_FOUR_HOURS),
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: IS_DEV,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;
let persister: ReturnType<typeof createIDBPersister> | undefined = undefined;

const getServerQueryClient = cache(() => makeQueryClient());

function getQueryClient() {
  if (isServer) {
    return getServerQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export const cancelBrowserQueries = (): void => {
  if (isServer) {
    return;
  }
  void getQueryClient().cancelQueries();
};

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

  useEffect(() => {
    if (IS_DEV) {
      void createIDBPersister().removeClient();
    }
  }, []);

  if (!idbPersister) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        {/* {IS_DEV ? (
          <ReactQueryDevtools
            hideDisabledQueries={true}
            theme="dark"
            initialIsOpen={false}
            buttonPosition="bottom-right"
          />
        ) : null} */}
      </QueryClientProvider>
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
      {/* {IS_DEV ? (
        <ReactQueryDevtools
          hideDisabledQueries={true}
          theme="dark"
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      ) : null} */}
    </PersistQueryClientProvider>
  );
}
