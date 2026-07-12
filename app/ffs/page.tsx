import { FfsDashboard } from "@/components/ffs/ffs-dashboard";
import { readAdminFlagState } from "@/lib/flags/flipt-admin";
import { buildDefaultAdminFlagState } from "@/lib/flags/flag-catalog";

export default async function FfsAdminPage() {
  let flags = buildDefaultAdminFlagState();
  try {
    flags = await readAdminFlagState();
  } catch (error) {
    console.warn("[ffs] failed to load flags for dashboard:", error);
  }

  return <FfsDashboard initialFlags={flags} />;
}
