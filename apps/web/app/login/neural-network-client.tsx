"use client";

import dynamic from "next/dynamic";
import { Loader } from "@/components/ui/loader";

export const NeuralNetworkBackground = dynamic(
  () => import("@/components/ui/neural-network-hero"),
  { ssr: false, loading: () => <Loader /> },
);
