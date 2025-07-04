import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata = {
  title: "Terms of Service - NyumatFlix",
  description: "Terms of Service for NyumatFlix streaming platform",
};

export default function TermsPage() {
  return (
    <div className="w-full flex flex-col">
      {/* Full viewport height background - fixed positioned */}
      <StaticHero imageUrl="/movie-banner.jpg" title="" route="" />

      {/* Content area - positioned to scroll over the fixed background */}
      <div className="relative z-10 min-h-[100dvh] w-full">
        <ContentContainer className="w-full flex flex-col items-center">
          <LegalPage title="Terms of Service">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                About NyumatFlix
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix is a free, open-source movie and TV show discovery
                platform. We help you discover content and find information
                about where to watch it online.{" "}
                <strong>
                  We do not host, store, or stream any video content.
                </strong>
                All video content is provided by external, independent streaming
                services and video players.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is released under the MIT License and is available on
                GitHub for anyone to review, use, or contribute to.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using NyumatFlix, you accept and agree to be
                bound by these terms and conditions. If you do not agree with
                these terms, please do not use this service. Since NyumatFlix
                requires no account registration, your continued use of the site
                constitutes acceptance of these terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Service Description
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix provides the following services:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Content Discovery:</strong> Browse and search for
                  movies and TV shows using data from The Movie Database (TMDb)
                </li>
                <li>
                  <strong>Information Display:</strong> View details about
                  movies and TV shows including cast, crew, ratings, and
                  descriptions
                </li>
                <li>
                  <strong>External Links:</strong> Provide links to external
                  video players and streaming services
                </li>
                <li>
                  <strong>Recommendations:</strong> Suggest similar content
                  based on your browsing
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                <strong>What we do NOT provide:</strong> Video hosting, content
                streaming, user accounts, paid subscriptions, or content
                downloads.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Use License & Restrictions
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Permission is granted to access NyumatFlix for personal,
                non-commercial use. Under this license you may not:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  Use automated tools to scrape or download content from our
                  site
                </li>
                <li>
                  Attempt to reverse engineer or modify our software (though you
                  can view the source code on GitHub)
                </li>
                <li>Use the service for any illegal activities</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Remove copyright or attribution notices</li>
                <li>
                  Use the service for commercial purposes without permission
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                External Content & Third-Party Services
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong>Important:</strong> NyumatFlix links to external video
                players and streaming services that are completely independent
                from us. When you click "Watch" or similar buttons:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  You will be directed to external websites (such as 2embed and
                  other video players)
                </li>
                <li>
                  These external sites have their own terms of service and
                  privacy policies
                </li>
                <li>
                  These external sites may show advertisements that we do not
                  control
                </li>
                <li>
                  The quality, availability, and legality of content on external
                  sites is not our responsibility
                </li>
                <li>
                  You use external sites at your own risk and subject to their
                  terms
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                NyumatFlix is not responsible for the content, practices, or
                policies of external video players or streaming services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Content Information & Copyright
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                All movie and TV show information displayed on NyumatFlix is
                sourced from:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>The Movie Database (TMDb):</strong> A community-built
                  movie and TV database
                </li>
                <li>
                  <strong>Public APIs:</strong> Legitimate content information
                  services
                </li>
                <li>
                  <strong>Official Sources:</strong> Studios, distributors, and
                  content owners
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We respect copyright and intellectual property rights. If you
                believe any content infringes your rights, please contact us
                through our GitHub repository.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                User Responsibilities
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                As a user of NyumatFlix, you are responsible for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  Ensuring your use complies with local laws and regulations
                </li>
                <li>
                  Understanding that external streaming sites may have different
                  legal requirements
                </li>
                <li>
                  Using appropriate ad blockers and security tools when visiting
                  external sites
                </li>
                <li>
                  Not engaging in any activity that could harm or interfere with
                  the service
                </li>
                <li>
                  Respecting the intellectual property rights of content
                  creators
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Disclaimer of Warranties
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is provided "as is" without any warranties, expressed
                or implied. We make no warranties regarding:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>The accuracy or completeness of content information</li>
                <li>
                  The availability or quality of external streaming services
                </li>
                <li>The security or safety of external websites</li>
                <li>Uninterrupted or error-free service</li>
                <li>
                  The legality of content on external sites in your jurisdiction
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix and its contributors shall not be liable for any
                damages arising from:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>Use of external streaming services or video players</li>
                <li>Advertisements or malware from external sites</li>
                <li>Inaccurate or outdated content information</li>
                <li>Service interruptions or technical issues</li>
                <li>
                  Any legal issues arising from your use of external streaming
                  services
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Open Source License
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is open source software released under the MIT
                License. This means:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>You can view, study, and contribute to the source code</li>
                <li>You can fork and modify the code for personal use</li>
                <li>Commercial use requires proper attribution</li>
                <li>The software is provided without warranty</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Changes to Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update these terms of service as needed. Changes will be
                posted on this page and in our GitHub repository. Your continued
                use of NyumatFlix after changes constitutes acceptance of the
                new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Governing Law
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These terms are governed by applicable laws. As an open-source
                project, we encourage users worldwide to ensure their use
                complies with local regulations regarding streaming and content
                access.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact Information
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms of Service, please contact us
                through our GitHub repository at github.com/nyumat/nyumatflix.
                As an open-source project, we welcome community feedback and
                contributions.
              </p>
            </section>
          </LegalPage>
        </ContentContainer>
      </div>
    </div>
  );
}
