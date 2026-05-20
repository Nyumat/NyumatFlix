import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { LegalPage } from "@/components/layout/legal-page";

const githubUrl = "https://github.com/Nyumat/NyumatFlix";

export const metadata = {
  title: "DMCA Policy - NyumatFlix",
  description: "DMCA Policy and Copyright Information for NyumatFlix",
};

export default function DMCAPage() {
  return (
    <div className="w-full flex flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />

      <div className="relative z-10 min-h-dvh w-full">
        <ContentContainer className="w-full flex flex-col items-center">
          <LegalPage title="DMCA Policy">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What Is on NyumatFlix
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix is a discovery app. We show metadata, images,
                recommendations, provider info, and links from third-party
                sources. We do not host, upload, store, cache, or stream movie,
                TV, or anime video files, and users cannot upload video here.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Video Lives Elsewhere
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Watch links and embedded players are run by other sites. If your
                claim is about a video file, stream, or upload hosted somewhere
                else, contact that site directly. We cannot remove files we do
                not host.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Copyright Issues
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you believe something on NyumatFlix itself infringes your
                rights, like a listing, image, description, or link, send a
                request on{" "}
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  GitHub
                </a>{" "}
                with these details:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>The copyrighted work involved.</li>
                <li>The exact NyumatFlix URL or item at issue.</li>
                <li>Your contact information.</li>
                <li>A good-faith statement that the use is not authorized.</li>
                <li>
                  A statement that your notice is accurate and that you are
                  authorized to act for the copyright owner.
                </li>
                <li>Your physical or electronic signature.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What Happens Next
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We will review complete requests and may remove or disable
                disputed listings, images, descriptions, or links when that
                makes sense. Repeated abuse of NyumatFlix accounts or features
                may lead to account restrictions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Counter-Notices
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If something was removed by mistake, contact us through the same
                GitHub repo with the removed material, where it used to be, your
                contact information, and why you think it was a mistake.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Copyright requests can be opened on{" "}
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  GitHub
                </a>{" "}
                with the subject "Copyright Inquiry - NyumatFlix". False or
                misleading DMCA notices can get you in legal trouble under
                Section 512(f).
              </p>
            </section>
          </LegalPage>
        </ContentContainer>
      </div>
    </div>
  );
}
