import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata = {
  title: "Privacy Policy - NyumatFlix",
  description: "Privacy Policy for NyumatFlix streaming platform",
};

export default function PrivacyPage() {
  return (
    <div className="w-full flex flex-col">
      {/* Full viewport height background - fixed positioned */}
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />

      {/* Content area - positioned to scroll over the fixed background */}
      <div className="relative z-10 min-h-dvh w-full">
        <ContentContainer className="w-full flex flex-col items-center">
          <LegalPage title="Privacy Policy">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                About NyumatFlix
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix is a free, open-source movie and TV show discovery
                platform. We help you discover content and find where to watch
                it online. We do not host any video content ourselves - we
                simply provide information about movies and TV shows using The
                Movie Database (TMDb) API and link to external streaming
                sources.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>Accounts are optional:</strong> You can browse most of
                the site without signing in. If you create an account (email
                magic link), we store the data needed for sign-in, your
                watchlist, and optional playback progress, as described below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Information We Collect
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We collect only what we need to run the service:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Basic Analytics:</strong> In production we use Umami
                  Analytics (privacy-focused) for aggregate usage such as page
                  views. It is designed not to profile individuals across sites.
                </li>
                <li>
                  <strong>Technical Data:</strong> Standard web server and
                  hosting logs (for example IP address, user agent, timestamps)
                  for security, abuse prevention, and performance.
                </li>
                <li>
                  <strong>Authentication (if you sign in):</strong> Email
                  address (for magic-link sign-in), optional display name and
                  profile image if you add them, session identifiers, and OAuth
                  tokens our auth library needs to keep you signed in. We send
                  sign-in links through Resend.
                </li>
                <li>
                  <strong>Watchlist and progress (if you sign in):</strong> TMDb
                  title identifiers, media type (movie or TV), status, and
                  optional last-watched episode or season so we can resume where
                  you left off.
                </li>
                <li>
                  <strong>Cookies:</strong> Strictly necessary cookies for
                  authentication when you use an account, plus cookies or
                  similar technologies used by our analytics provider. We do not
                  use advertising or cross-site tracking cookies on NyumatFlix
                  itself.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                <strong>We do NOT:</strong> Sell your personal data, run
                third-party ad networks on our own pages, or require payment to
                use NyumatFlix.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                How We Use Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The limited information we collect is used solely to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Maintain and improve website performance</li>
                <li>
                  Understand which content is popular to improve recommendations
                </li>
                <li>
                  Provide signed-in features (watchlist, progress, onboarding)
                </li>
                <li>Detect and prevent technical issues or abuse</li>
                <li>Comply with legal requirements if necessary</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Third-Party Services & External Content
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix integrates with several external services:
              </p>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Content Information
                </h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong>The Movie Database (TMDb):</strong> We fetch all
                    movie and TV show information from TMDb's public API. Review
                    their privacy policy at themoviedb.org.
                  </li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Analytics
                </h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong>Umami Analytics:</strong> Hosted analytics focused
                    on aggregate traffic. See umami.is for their practices.
                  </li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Email delivery
                </h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong>Resend:</strong> Sends magic-link emails when you
                    sign in. Resend processes the recipient address and delivery
                    metadata needed to complete the request.
                  </li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Database & hosting
                </h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    Account and watchlist data are stored in a PostgreSQL
                    database (for example Neon) controlled as part of this
                    deployment.
                  </li>
                  <li>
                    The site may be served from edge or serverless
                    infrastructure (for example Vercel), which processes
                    requests and standard HTTP metadata.
                  </li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  External Video Players
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  When you choose to watch content, you'll be directed to
                  external video players and streaming sites (such as 2embed and
                  others). These external sites:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Have their own privacy policies and terms of service</li>
                  <li>
                    May show advertisements (we have no control over these ads)
                  </li>
                  <li>May collect their own analytics and user data</li>
                  <li>Are completely independent from NyumatFlix</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  <strong>Important:</strong> NyumatFlix is not responsible for
                  the privacy practices of external video players or streaming
                  sites.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Data Sharing
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell your personal information. Service providers
                (hosting, database, email, analytics) process data only to
                operate NyumatFlix. Sharing otherwise occurs when:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>Analytics data is processed by Umami under their terms</li>
                <li>
                  Standard web requests to TMDb API for content information
                </li>
                <li>
                  Email delivery is handled by Resend when you request a link
                </li>
                <li>Legal compliance if required by law enforcement</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Data Security & Retention
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We protect data in line with the sensitivity of what we store.
                In general we:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Use HTTPS encryption for all connections</li>
                <li>Regularly update our systems and dependencies</li>
                <li>Store minimal data for the shortest time necessary</li>
                <li>Delete server logs after a reasonable period</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Your Rights & Control
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Depending on where you live, you may have rights to access,
                correct, export, or delete personal data. For NyumatFlix:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Browsing:</strong> You can use much of the site
                  without an account.
                </li>
                <li>
                  <strong>Cookies:</strong> You can limit cookies in your
                  browser; disabling auth cookies will sign you out.
                </li>
                <li>
                  <strong>Analytics:</strong> You can use privacy tools or
                  blockers that affect third-party scripts.
                </li>
                <li>
                  <strong>Account data:</strong> Contact us via the GitHub
                  repository listed below to request deletion or export of data
                  tied to your account. We will verify reasonable requests.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Advertising
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix itself is completely ad-free. However, when you visit
                external video players or streaming sites that we link to, those
                sites may display their own advertisements. We have no control
                over these external ads and are not responsible for their
                content or privacy practices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Children's Privacy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The service is not directed at children under 13, and we do not
                knowingly collect data from children without appropriate
                consent. Parents should supervise minors&apos; use of external
                streaming sites we link to.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Open Source & Transparency
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is open source software released under the MIT
                License. You can review our complete source code on GitHub to
                see exactly how we handle data and what information we collect.
                This transparency ensures you can verify our privacy practices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Changes to Privacy Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this privacy policy to reflect changes in our
                practices or legal requirements. Since we don't collect contact
                information, we'll post updates on this page and in our GitHub
                repository.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about this Privacy Policy, please contact
                us through our GitHub repository at
                github.com/nyumat/nyumatflix. As an open-source project, we're
                committed to transparency and will address any privacy concerns.
              </p>
            </section>
          </LegalPage>
        </ContentContainer>
      </div>
    </div>
  );
}
