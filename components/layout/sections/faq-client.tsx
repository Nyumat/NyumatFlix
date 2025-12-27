"use client";

import dynamic from "next/dynamic";

const FAQSectionComponent = dynamic(
  () =>
    import("@/components/layout/sections/faq").then((mod) => mod.FAQSection),
  { ssr: false },
);

export const FAQSectionClient = () => {
  return <FAQSectionComponent />;
};
