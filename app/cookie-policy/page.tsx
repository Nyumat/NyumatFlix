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
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />

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
                platform. We use a small number of cookies and similar
                technologies so the site works, so you can stay signed in if you
                choose, and so we can measure aggregate traffic. &quot;Where to
                watch&quot; data is requested from TMDb for a fixed region (US),
                not based on your location.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>No ad tracking on our pages:</strong> We do not run
                third-party ad networks on NyumatFlix itself or use marketing
                cookies for cross-site profiling.
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
                NyumatFlix uses cookies for strictly necessary authentication
                (when you sign in), optional client preferences, and
                privacy-oriented analytics in production:
              </p>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Essential and authentication cookies
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  When you sign in with a magic link, Auth.js (NextAuth) sets
                  HTTP-only session cookies so we know which account is
                  connected. These are necessary for watchlist and progress
                  features. There may also be short-lived CSRF or callback
                  cookies during sign-in.
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Session and security cookies for logged-in users</li>
                  <li>Basic website functionality</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Analytics
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  In production we load Umami Analytics, which may set its own
                  cookies or use storage to measure aggregate traffic. See
                  umami.is for details.
                </p>
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
                  <strong>Ad-tech remarketing:</strong> We do not run
                  remarketing pixels for ads on NyumatFlix
                </li>
                <li>
                  <strong>Cross-site ad profiles:</strong> We do not sell data
                  to ad networks for profiling you across the web
                </li>
                <li>
                  <strong>Embedded ad SDKs:</strong> We do not load third-party
                  advertising network scripts on NyumatFlix pages
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
                  <strong>Browsing:</strong> Much of the site may still work for
                  discovering content
                </li>
                <li>
                  <strong>Sign-in:</strong> You will not stay signed in if you
                  block authentication cookies
                </li>
                <li>
                  <strong>Analytics:</strong> Aggregate measurement may be
                  reduced or blocked
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
                  <strong>Session cookies:</strong> Tied to your sign-in session
                  and expire when the session ends or after the period set by
                  the auth library
                </li>
                <li>
                  <strong>Analytics:</strong> As described by Umami for their
                  script
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
