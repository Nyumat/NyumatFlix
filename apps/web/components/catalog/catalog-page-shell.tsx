import { IndexHeader } from "@/components/catalog/index-header";
import { IndexPage } from "@/components/catalog/index-page";
import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import type { ReactNode } from "react";

type CatalogPageShellProps = {
  title: string;
  backdrop?: PageBackdrop | null;
  toolbar?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export const CatalogPageShell = ({
  title,
  backdrop,
  toolbar,
  action,
  children,
  className,
}: CatalogPageShellProps) => (
  <IndexPage
    backdrop={backdrop}
    header={<IndexHeader title={title} action={action} />}
    toolbar={
      toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {toolbar}
        </div>
      ) : undefined
    }
    className={className}
  >
    {children}
  </IndexPage>
);
