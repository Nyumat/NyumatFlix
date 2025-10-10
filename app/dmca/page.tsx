import { StaticHero } from "@/components/hero/carousel-static";
import { ContentContainer } from "@/components/layout/content-container";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata = {
  title: "DMCA Policy - NyumatFlix",
  description:
    "DMCA Policy and Copyright Information for NyumatFlix streaming platform",
};

export default function DMCAPage() {
  return (
    <div className="w-full flex flex-col">
      {/* Full viewport height background - fixed positioned */}
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />

      {/* Content area - positioned to scroll over the fixed background */}
      <div className="relative z-10 min-h-[100dvh] w-full">
        <ContentContainer className="w-full flex flex-col items-center">
          <LegalPage title="DMCA Policy">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                About NyumatFlix & Copyright
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix is a free, open-source movie and TV show discovery
                platform.{" "}
                <strong>
                  We do not host, store, upload, or distribute any copyrighted
                  video content.
                </strong>{" "}
                We are purely an information aggregation service that helps
                users discover content and find information about movies and TV
                shows.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                All content information displayed on NyumatFlix comes from The
                Movie Database (TMDb), a legitimate, community-built database
                that provides publicly available metadata about movies and TV
                shows.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What NyumatFlix Actually Does
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                To clarify our role in the content ecosystem:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Content Discovery:</strong> We display movie and TV
                  show information from TMDb's public API
                </li>
                <li>
                  <strong>External Linking:</strong> We provide links to
                  external video players and streaming services
                </li>
                <li>
                  <strong>Information Aggregation:</strong> We organize and
                  present publicly available content metadata
                </li>
                <li>
                  <strong>No Content Hosting:</strong> We do not store, cache,
                  or serve any video files
                </li>
                <li>
                  <strong>No Content Uploads:</strong> Users cannot upload
                  content to our platform
                </li>
                <li>
                  <strong>No User Accounts:</strong> We have no user-generated
                  content or user profiles
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                DMCA Compliance Statement
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix respects intellectual property rights and complies
                with the Digital Millennium Copyright Act (DMCA). However, since
                we do not host any copyrighted content, traditional DMCA
                takedown procedures may not apply directly to our service.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If you believe that information displayed on our site infringes
                your copyright, we will investigate and take appropriate action,
                which may include removing information or links if warranted.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                External Content & Responsibility
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong>Important:</strong> When users click "Watch" or similar
                buttons on NyumatFlix, they are directed to external,
                independent websites and video players (such as 2embed and
                others). These external sites:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Are completely independent from NyumatFlix</li>
                <li>
                  Host their own content or provide their own streaming services
                </li>
                <li>Have their own DMCA policies and copyright procedures</li>
                <li>Are responsible for the content they host or stream</li>
                <li>
                  Should be contacted directly for copyright infringement claims
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                <strong>
                  NyumatFlix is not responsible for content hosted on external
                  streaming sites.
                </strong>
                Copyright holders should contact the actual hosting services
                directly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Content Information Sources
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                All movie and TV show information on NyumatFlix comes from
                legitimate sources:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>The Movie Database (TMDb):</strong> A community-built
                  database with publicly available content metadata
                </li>
                <li>
                  <strong>Official APIs:</strong> Legitimate content information
                  services
                </li>
                <li>
                  <strong>Public Information:</strong> Release dates, cast,
                  crew, and synopsis information that is publicly available
                </li>
                <li>
                  <strong>Fair Use Content:</strong> Movie posters and
                  promotional images used under fair use for informational
                  purposes
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                How to File a Copyright Complaint
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you believe that information or images displayed on
                NyumatFlix infringe your copyright, please provide:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  Identification of the copyrighted work claimed to be infringed
                </li>
                <li>
                  Specific location of the allegedly infringing material on our
                  site
                </li>
                <li>Your contact information (email, phone, address)</li>
                <li>
                  A statement of good faith belief that the use is not
                  authorized
                </li>
                <li>
                  A statement that the information is accurate and you are
                  authorized to act
                </li>
                <li>Your physical or electronic signature</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                <strong>Note:</strong> Since we only display information and
                don't host video content, most copyright concerns should be
                directed to the actual hosting services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact for Copyright Issues
              </h2>
              <div className="bg-black/30 border border-white/20 rounded-lg p-6 mb-4">
                <p className="text-foreground font-semibold mb-2">
                  Copyright Agent:
                </p>
                <p className="text-muted-foreground">
                  GitHub: github.com/nyumat/nyumatflix
                  <br />
                  Subject: "Copyright Inquiry - NyumatFlix"
                </p>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Please note that under Section 512(f) of the DMCA, knowingly
                making false claims may result in liability for damages.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Counter-Notification Process
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you believe content was removed in error, you may file a
                counter-notification including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Your physical or electronic signature</li>
                <li>
                  Identification of the removed content and its previous
                  location
                </li>
                <li>
                  A statement under penalty of perjury that removal was due to
                  mistake or misidentification
                </li>
                <li>Your contact information and consent to jurisdiction</li>
                <li>
                  Statement accepting service of process from the original
                  complainant
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Repeat Infringer Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                While NyumatFlix has no user accounts or user-generated content,
                we maintain a policy of removing persistent infringing
                information if notified by copyright holders. Since we don't
                host content, this typically involves removing information or
                links rather than content itself.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Fair Use & Educational Purpose
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix operates under fair use principles by:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>Providing factual information about movies and TV shows</li>
                <li>
                  Using promotional images for identification and information
                  purposes
                </li>
                <li>
                  Enabling content discovery and education about entertainment
                  media
                </li>
                <li>Not competing with or replacing the original content</li>
                <li>Operating as a non-commercial, open-source project</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Open Source Transparency
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is open source software released under the MIT
                License. Our complete source code is available on GitHub,
                allowing anyone to verify that we do not host, store, or
                distribute copyrighted content. This transparency demonstrates
                our commitment to legal compliance and copyright respect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix and its contributors are not liable for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>Content hosted on external streaming services</li>
                <li>Copyright infringement by third-party sites we link to</li>
                <li>User actions on external websites</li>
                <li>
                  Accuracy of information provided by TMDb or other data sources
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                International Considerations
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is available globally and respects international
                copyright laws. Users are responsible for ensuring their use of
                external streaming services complies with copyright laws in
                their jurisdiction. We will cooperate with legitimate legal
                requests from authorized representatives worldwide.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Policy Updates
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this DMCA policy to reflect changes in law, our
                practices, or service functionality. Updates will be posted on
                this page and in our GitHub repository.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact Information
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                For copyright-related inquiries, please contact us through our
                GitHub repository at github.com/nyumat/nyumatflix. We are
                committed to addressing legitimate copyright concerns promptly
                and fairly while maintaining our role as a content discovery
                platform.
              </p>
            </section>
          </LegalPage>
        </ContentContainer>
      </div>
    </div>
  );
}
