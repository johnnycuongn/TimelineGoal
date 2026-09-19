/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5
 * genre: playful (couples, consumer, warm — the Hum register) · macrostructure: Narrative Workflow
 * theme: project-locked (CoupleGoal rose tokens in src/styles.css · Fredoka + Nunito).
 *   Catalog/custom dispatch skipped on purpose: the brief locks the palette and the type,
 *   so this run treats src/styles.css the way Hallmark treats a design.md project.
 * hero: H9 custom-illustration centerpiece · knobs: build = the product's own <Pup> R3F
 *   component (no invented imagery), animation = its own idle loop, scale = dominant,
 *   laid out 7/5 at >= lg so copy, CTA and the pup all sit in a 1280x800 fold.
 * sections: S2 hanging head · F4 step sequence · knobs: numbering = 01-04 (the app's four
 *   real horizons, genuinely ordinal), layout = vertical stack, connector = numbered rule.
 * CTAs: hero = filled pill + C3 typographic link · close = C1 outlined chip (pill, arrow).
 * nav: AppShell's existing header (owned elsewhere, not re-picked) · footer: Ft5 statement,
 *   carrying the CC BY 4.0 model credit so it ships visibly on a public page.
 * motion: none added. The pup's idle loop and Button's press scale are the page's only
 *   motion, both already reduced-motion aware.
 * icons: Lucide only (30) · honest: no invented metrics, testimonials or logos (46)
 * chrome: no re-drawn browser/phone frames (47) · tokens: every colour via a token (48)
 */
import { ArrowRight, PawPrint } from "lucide-react";
import { Link } from "react-router";
import Pup from "@/components/pup/pup";
import { Button } from "@/components/ui/button";

interface Stage {
  n: string;
  horizon: string;
  body: string;
}

const STAGES: Stage[] = [
  {
    n: "01",
    horizon: "Day",
    body:
      "Habits are the small things you do daily, and you each get one paw print a day on one. " +
      "Your last seven days sit under your name as dots, and a run of days gets counted. " +
      "Miss one and nothing turns red.",
  },
  {
    n: "02",
    horizon: "Month",
    body:
      "A month gets milestones, and you say how many paw prints each one takes. " +
      "Every stamp fills one. A milestone that belongs to both of you waits for both paws " +
      "in the wax before it counts as sealed.",
  },
  {
    n: "03",
    horizon: "Quarter",
    body:
      "A month's milestone can point at the quarter's, and then the small things climb: " +
      "fill the little one and part of a paw lands on the bigger one. " +
      "A quiet Tuesday still moves the big thing.",
  },
  {
    n: "04",
    horizon: "Year",
    body:
      "The year is where the dream goes, written down where you both see it. " +
      "Everything here is shared, so there is no scoreboard and nothing to compare.",
  },
];

function Stages() {
  return (
    <ol className="m-0 mt-8 list-none space-y-8 p-0 sm:mt-10 sm:space-y-10">
      {STAGES.map((stage) => (
        <li
          className="border-primary/20 border-t-2 pt-6 first:border-t-0 first:pt-0"
          key={stage.horizon}
        >
          <h3 className="display-title m-0 flex items-baseline gap-3 text-2xl sm:text-3xl">
            <span className="text-primary tabular-nums">{stage.n}</span>
            {stage.horizon}
          </h3>
          <p className="m-0 mt-3 max-w-[60ch] text-muted-foreground">{stage.body}</p>
        </li>
      ))}
    </ol>
  );
}

export default function LandingPage() {
  return (
    <div className="page-wrap pb-12 sm:pb-16">
      <section className="grid items-center gap-8 pt-8 pb-12 sm:pb-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
        <div className="min-w-0">
          <p className="island-kicker mb-3">For the two of you</p>
          <h1 className="display-title mb-4 text-4xl leading-[1.06] sm:text-5xl lg:text-6xl">
            Small taps, big dreams, one pup.
          </h1>
          <p className="mb-7 max-w-[54ch] text-lg text-muted-foreground">
            A den for two. Keep your daily habits and your yearly dreams in one cosy place, and let
            your pup cheer every paw print.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Link
              className="focus-ring inline-flex min-h-11 items-center whitespace-nowrap rounded-full font-semibold text-foreground underline decoration-2 decoration-primary underline-offset-2 hover:text-primary"
              to="/login"
            >
              Join with a code
            </Link>
          </div>
        </div>
        <div className="island-shell min-w-0 overflow-hidden p-2 sm:p-3">
          <Pup name="Your pup" />
          <p className="m-0 pb-1 text-center text-muted-foreground text-xs">
            Give them a boop, or drag to turn them around.
          </p>
        </div>
      </section>

      <section className="border-border border-t pt-10 sm:pt-14">
        {/* The stage rules stop with the measure: a full-width rule over a 60ch
            paragraph reads as a section with its right half missing. */}
        <div className="max-w-3xl">
          <h2 className="display-title m-0 max-w-[24ch] text-3xl sm:text-4xl">
            A year, in four sizes.
          </h2>
          <p className="m-0 mt-3 max-w-[60ch] text-muted-foreground">
            Day, month, quarter, year: the same paw print, at four different distances.
          </p>
          <Stages />
        </div>
      </section>

      <section className="mt-10 rounded-[var(--radius-xl)] bg-muted p-6 sm:mt-14 sm:p-8">
        <h2 className="display-title m-0 max-w-[26ch] text-2xl sm:text-3xl">
          One paw is enough to start.
        </h2>
        <p className="m-0 mt-3 mb-6 max-w-[56ch] text-muted-foreground">
          Make a den, send your person the code, and name the pup together.
        </p>
        <Button asChild variant="outline">
          <Link to="/login">
            Sign in
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>

      <footer className="mt-12 border-border border-t pt-8 sm:mt-16">
        <p className="display-title m-0 flex items-baseline gap-3 text-2xl sm:text-3xl">
          <PawPrint aria-hidden="true" className="size-6 shrink-0 text-primary" />
          Two people. One pup. A year of small paw prints.
        </p>
        <p className="m-0 mt-4 max-w-[70ch] text-muted-foreground text-xs leading-6">
          The pup is{" "}
          <a
            className="focus-ring rounded-sm underline"
            href="https://sketchfab.com/3d-models/bulldog-puppy-7081c9c27df244bf84774361888f58a2"
            rel="noopener noreferrer"
            target="_blank"
          >
            "Bulldog Puppy" by doinspire
          </a>
          , licensed{" "}
          <a
            className="focus-ring rounded-sm underline"
            href="https://creativecommons.org/licenses/by/4.0/"
            rel="noopener noreferrer"
            target="_blank"
          >
            CC BY 4.0
          </a>
          . Skeleton and animations from the Ultimate Animated Animal Pack by{" "}
          <a
            className="focus-ring rounded-sm underline"
            href="https://quaternius.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            Quaternius
          </a>{" "}
          (CC0).
        </p>
      </footer>
    </div>
  );
}
