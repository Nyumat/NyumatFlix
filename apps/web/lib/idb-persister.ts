import { get, set, del } from "idb-keyval";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

const IDB_KEY = "nyumatflix-query-cache";

export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(IDB_KEY, client);
      } catch (error) {
        console.warn("Unable to persist query cache:", error);
        throw error;
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(IDB_KEY);
      } catch (error) {
        console.warn("Unable to restore query cache:", error);
        throw error;
      }
    },
    removeClient: async () => {
      try {
        await del(IDB_KEY);
      } catch (error) {
        console.warn("Unable to remove query cache:", error);
        throw error;
      }
    },
  };
}
