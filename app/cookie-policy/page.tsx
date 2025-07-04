import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata = {
  title: "Cookie Policy - NyumatFlix",
  description: "Cookie Policy for NyumatFlix streaming platform",
};

export default function CookiePolicyPage() {
  return (
    <div className="w-full flex flex-col">
      {/* Full viewport height background - fixed positioned */}
      <StaticHero imageUrl="/movie-banner.jpg" title="" route="" />

      {/* Content area - positioned to scroll over the fixed background */}
      <div className="relative z-10 min-h-[100dvh] w-full">
        <ContentContainer className="w-full flex flex-col items-center">
          <LegalPage title="Cookie Policy">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                About NyumatFlix & Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix is a free, open-source movie and TV show discovery
                platform that requires no user accounts or personal information.
                We use minimal cookies to ensure the website functions properly
                and to understand general usage patterns through privacy-focused
                analytics.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>No Tracking:</strong> We do not use tracking cookies,
                advertising cookies, or any cookies that identify individual
                users across sessions or websites.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What Are Cookies?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies are small text files stored on your device when you
                visit websites. They help websites remember information about
                your visit, such as your preferred settings or browsing session.
                Cookies cannot access other files on your device or install
                software.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                How NyumatFlix Uses Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix uses cookies for essential functionality and
                privacy-focused analytics only:
              </p>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Essential Cookies
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  These cookies are necessary for the website to function
                  properly:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Theme preferences (dark/light mode)</li>
                  <li>Basic website functionality</li>
                  <li>Security and error prevention</li>
                  <li>Session management for browsing</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Analytics Cookies
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  We use Umami Analytics, a privacy-focused analytics service
                  that:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>
                    Collects anonymized usage statistics (page views, popular
                    content)
                  </li>
                  <li>
                    Does not track individual users or create user profiles
                  </li>
                  <li>Does not use persistent identifiers across sessions</li>
                  <li>
                    Helps us understand which content is popular to improve
                    recommendations
                  </li>
                  <li>Is GDPR compliant and privacy-focused by design</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What We DON'T Use
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix explicitly does NOT use:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Advertising Cookies:</strong> No ads means no
                  advertising tracking
                </li>
                <li>
                  <strong>Social Media Cookies:</strong> No social media
                  integration or tracking
                </li>
                <li>
                  <strong>User Profile Cookies:</strong> No user accounts means
                  no profile tracking
                </li>
                <li>
                  <strong>Cross-Site Tracking:</strong> We don't track you
                  across other websites
                </li>
                <li>
                  <strong>Persistent User IDs:</strong> No unique identifiers
                  tied to individuals
                </li>
                <li>
                  <strong>Marketing Cookies:</strong> No marketing or
                  remarketing functionality
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                External Website Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong>Important:</strong> When you click to watch content,
                you'll be directed to external video players and streaming sites
                (such as 2embed and others). These external sites:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Have their own cookie policies and privacy practices</li>
                <li>May use advertising cookies and tracking technologies</li>
                <li>
                  May collect personal information and create user profiles
                </li>
                <li>Are completely independent from NyumatFlix</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                NyumatFlix has no control over cookies used by external
                streaming sites. Please review their individual cookie policies
                and privacy settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Managing Your Cookie Preferences
              </h2>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Browser Settings
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  You can control cookies through your browser settings:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>
                    <strong>Chrome:</strong> Settings → Privacy and Security →
                    Cookies and other site data
                  </li>
                  <li>
                    <strong>Firefox:</strong> Settings → Privacy & Security →
                    Cookies and Site Data
                  </li>
                  <li>
                    <strong>Safari:</strong> Preferences → Privacy → Cookies and
                    website data
                  </li>
                  <li>
                    <strong>Edge:</strong> Settings → Cookies and site
                    permissions → Cookies and site data
                  </li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Analytics Opt-Out
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  To opt out of our privacy-focused analytics:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>
                    Use ad blockers like uBlock Origin (which we actually
                    recommend)
                  </li>
                  <li>Enable "Do Not Track" in your browser settings</li>
                  <li>
                    Use privacy-focused browsers like Firefox with strict
                    privacy settings
                  </li>
                  <li>
                    Disable JavaScript (though this may affect website
                    functionality)
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Impact of Disabling Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you disable cookies on NyumatFlix:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Essential Functions:</strong> The website will still
                  work for browsing and discovering content
                </li>
                <li>
                  <strong>Theme Settings:</strong> Your dark/light mode
                  preference won't be remembered
                </li>
                <li>
                  <strong>Analytics:</strong> We won't collect any usage
                  statistics (which is fine!)
                </li>
                <li>
                  <strong>No Account Impact:</strong> Since there are no user
                  accounts, no login functionality is affected
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Cookie Retention
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our cookies have minimal retention periods:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>
                  <strong>Essential Cookies:</strong> Expire when you close your
                  browser or after 1 year maximum
                </li>
                <li>
                  <strong>Analytics Cookies:</strong> Short-term session cookies
                  that don't persist across visits
                </li>
                <li>
                  <strong>Theme Preferences:</strong> Stored locally until you
                  clear browser data
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Open Source Transparency
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                As an open-source project, you can review our complete source
                code on GitHub to see exactly how we handle cookies and what
                data we collect. This transparency ensures you can verify our
                cookie practices and privacy commitments.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Updates to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Cookie Policy to reflect changes in our
                practices or legal requirements. Updates will be posted on this
                page and in our GitHub repository. Since we don't collect
                contact information, we cannot notify users directly of changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about our cookie usage, please contact us
                through our GitHub repository at github.com/nyumat/nyumatflix.
                We're committed to transparency and privacy in our open-source
                project.
              </p>
            </section>
          </LegalPage>
        </ContentContainer>
      </div>
    </div>
  );
}
