import { IndexHeader } from "@/components/catalog/index-header";
import { IndexPage } from "@/components/catalog/index-page";
import { LegalPage } from "@/components/layout/legal-page";
import Link from "next/link";

export const metadata = {
  title: "Big News",
};

export default function AdFreePage() {
  return (
    <IndexPage header={<IndexHeader title="Ad-Free, On Purpose" />}>
      <LegalPage title="Ad-Free, On Purpose">
        <div className="mx-auto max-w-2xl space-y-6 text-left">
          <p className="text-lg leading-relaxed text-foreground sm:text-xl">
            Despite being yet another streaming site that could make money from
            ads on every single thing you can click on here, we don&apos;t care.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            That said, we&apos;re now ad-free.{" "}
            <Link
              href="https://nyuma.dev/b/downloader#nyumatflix"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              I talk about "how" in more detail here
            </Link>
            . So, when you click play, you'll see the new UI. It's pretty
            intuitive
          </p>

          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            but remember fam, if it needs fixing, we're{" "}
            <Link
              href="https://github.com/nyumat/nyumatflix"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              open source
            </Link>
            .
          </p>
        </div>
      </LegalPage>
    </IndexPage>
  );
}
