import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { LegalPage } from "@/components/layout/legal-page";

const anilistUrl = "https://anilist.co";
const githubUrl = "https://github.com/Nyumat/NyumatFlix";
const resendUrl = "https://resend.com";
const tmdbUrl = "https://www.themoviedb.org";
const umamiUrl = "https://umami.is";

export const metadata = {
  title: "Privacy Policy - NyumatFlix",
  description: "Privacy Policy for NyumatFlix",
};

export default function PrivacyPage() {
  return (
    <div className="w-full flex flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />

      <div className="relative z-10 min-h-dvh w-full">
        <ContentContainer className="w-full flex flex-col items-center">
          <LegalPage title="Privacy Policy">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What We Collect
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                NyumatFlix keeps data collection pretty minimal. You can browse
                without an account. If you sign in, we store the account,
                watchlist, and progress data needed to make those features work.
                We do not sell personal data, and we do not run ad tracking on
                NyumatFlix pages.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                The Details
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  Basic technical logs, like browser details and timestamps, so
                  the app can stay reliable and secure.
                </li>
                <li>
                  Privacy-friendly analytics through{" "}
                  <a
                    href={umamiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    Umami
                  </a>
                  {", used to understand aggregate app usage."}
                </li>
                <li>
                  Your email, session data, and optional profile details if you
                  sign in.
                </li>
                <li>
                  Watchlist, status, and progress data if you use those
                  features.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Why We Use It
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use this data to keep the app running, sign you in, save your
                watchlist and progress, understand what parts of the app are
                used, prevent abuse, and handle legal requirements if they come
                up.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Outside Services
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                NyumatFlix relies on a few outside services:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <a
                    href={tmdbUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    TMDb
                  </a>{" "}
                  and{" "}
                  <a
                    href={anilistUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    AniList
                  </a>{" "}
                  provide title metadata.
                </li>
                <li>
                  <a
                    href={resendUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    Resend
                  </a>{" "}
                  sends sign-in emails.
                </li>
                <li>
                  Hosting, database, and analytics providers process what is
                  needed to run the app.
                </li>
                <li>
                  External watch links and embedded players are separate sites
                  with their own privacy practices.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies or browser storage to keep you signed in and to
                support limited analytics. Blocking essential cookies can break
                account features.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Your Choices
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You can browse without signing in, block analytics with privacy
                tools, clear cookies in your browser, or ask us to delete
                account data through{" "}
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  GitHub
                </a>
                {
                  ". We may need to confirm the account is yours before changing or "
                }
                deleting account data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Contact
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Questions or privacy requests can be opened on{" "}
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
