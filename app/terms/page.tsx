import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { LegalPage } from "@/components/layout/legal-page";

const githubUrl = "https://github.com/Nyumat/NyumatFlix";

export const metadata = {
  title: "Terms of Service - NyumatFlix",
  description: "Terms of Service for NyumatFlix",
};

export default function TermsPage() {
  return (
    <div className="w-full flex flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />

      <div className="relative z-10 min-h-dvh w-full">
        <ContentContainer className="w-full flex flex-col items-center">
          <LegalPage title="Terms of Service">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What This App Does
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is a free, open-source app for finding movies, TV,
                and anime. You can browse titles, check details, watch trailers,
                find providers, and save watchlist or progress if you sign in.
                We do not sell subscriptions, and we do not host, upload, store,
                or stream video files from our own servers.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Basic Rules
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Use NyumatFlix normally. Be Normal. Please, do not:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Overload, scrape, or break the site.</li>
                <li>Try to access someone else&apos;s account or data.</li>
                <li>Abuse external players, providers, or APIs.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Accounts
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Accounts are optional. If you sign in, your email magic link is
                what gets you into your account, so keep your email secure.
                Watchlists and progress are convenience features, and they may
                change as the app changes. You can stop using your account at
                any time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Outside Links
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Title data comes from services like TMDb and AniList. Watch
                links, embedded players, provider pages, and other external
                sites are not run by NyumatFlix. They may have their own rules,
                ads, privacy policies, availability, and restrictions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Things Can Be Wrong
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We do our best, but metadata, ratings, links, providers,
                playback availability, and outside sites can be missing,
                outdated, unavailable, or wrong.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Open Source
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is open-source software released under the MIT
                License. You can review the code or contribute on{" "}
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

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions, issues, or account deletion requests,
                open something on{" "}
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
