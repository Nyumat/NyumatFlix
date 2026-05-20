import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { LegalPage } from "@/components/layout/legal-page";

const githubUrl = "https://github.com/Nyumat/NyumatFlix";

export const metadata = {
  title: "Cookie Policy - NyumatFlix",
  description: "Cookie Policy for NyumatFlix",
};

export default function CookiePolicyPage() {
  return (
    <div className="w-full flex flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />

      <div className="relative z-10 min-h-dvh w-full">
        <ContentContainer className="w-full flex flex-col items-center">
          <LegalPage title="Cookie Policy">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                How Cookies Are Used
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix uses a small number of cookies and browser storage so
                the app works, signed-in users stay signed in, and we can see
                basic aggregate usage. We do not use ad-tracking cookies or
                cross-site marketing pixels on NyumatFlix pages.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What We Store
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  Session and security cookies for magic-link sign-in,
                  watchlists, and progress.
                </li>
                <li>Local browser storage for app settings when needed.</li>
                <li>
                  Privacy-friendly analytics through{" "}
                  <a
                    href="https://umami.is"
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    Umami
                  </a>{" "}
                  to understand aggregate traffic.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What We Do Not Do
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix does not run third-party ad networks, remarketing
                pixels, social media tracking widgets, or cookies for selling
                ads based on what you do here.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                External Sites
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                External watch links, embedded players, providers, and other
                sites are separate from NyumatFlix. They may use their own
                cookies, ads, analytics, or tracking. Those choices belong to
                those sites, not us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Your Choices
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You can block or clear cookies in your browser. Most browsing
                should still work, but blocking essential cookies will break
                sign-in, watchlist, and progress features. Privacy tools and
                browser settings may also block analytics.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Questions can be opened on{" "}
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  GitHub
                </a>
                {"."}
              </p>
            </section>
          </LegalPage>
        </ContentContainer>
      </div>
    </div>
  );
}
