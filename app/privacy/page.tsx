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
      <StaticHero imageUrl="/movie-banner.jpg" title="" route="" />

      {/* Content area - positioned to scroll over the fixed background */}
      <div className="relative z-10 min-h-[100dvh] w-full">
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
                <strong>No Account Required:</strong> NyumatFlix does not
                require user registration, login, or any personal account
                creation. You can browse and discover content completely
                anonymously.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Information We Collect
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Since NyumatFlix has no user accounts or registration system, we
                collect minimal information:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Basic Analytics:</strong> We use Umami Analytics
                  (privacy-focused) to understand general usage patterns like
                  page views and popular content. This data is anonymized and
                  does not identify individual users.
                </li>
                <li>
                  <strong>Technical Data:</strong> Standard web server logs
                  including IP addresses, browser type, and timestamps for
                  security and performance monitoring.
                </li>
                <li>
                  <strong>Cookies:</strong> Essential cookies for basic website
                  functionality and analytics. No tracking or advertising
                  cookies.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                <strong>We do NOT collect:</strong> Names, email addresses,
                passwords, payment information, personal profiles, or any
                personally identifiable information.
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
                    <strong>Umami Analytics:</strong> Privacy-focused analytics
                    that doesn't track users across sites or collect personal
                    data.
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
                We do not sell, trade, or share any user data with third
                parties. The only data sharing that occurs is:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>Anonymized analytics data processed by Umami</li>
                <li>
                  Standard web requests to TMDb API for content information
                </li>
                <li>Legal compliance if required by law enforcement</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Data Security & Retention
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Since we don't collect personal data, security risks are
                minimal. However, we:
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
                Since NyumatFlix doesn't require accounts or collect personal
                information, there's minimal data to control. However:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Cookies:</strong> You can disable cookies in your
                  browser settings (may affect functionality)
                </li>
                <li>
                  <strong>Analytics:</strong> You can opt out of analytics by
                  using ad blockers or privacy tools
                </li>
                <li>
                  <strong>Access:</strong> You can browse completely anonymously
                  without creating any account
                </li>
                <li>
                  <strong>Data Deletion:</strong> Since we don't store personal
                  data, there's nothing to delete
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
                Since NyumatFlix doesn't collect personal information from
                anyone, including children under 13, we are inherently compliant
                with children's privacy requirements. Parents should supervise
                their children's use of external streaming sites that we link
                to.
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
