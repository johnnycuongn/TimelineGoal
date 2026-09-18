import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <section className="page-wrap pt-10 pb-8 sm:pt-16">
      <p className="island-kicker mb-4">For the two of you</p>
      <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.05] sm:text-6xl">
        Small taps, big dreams, one pup.
      </h1>
      <p className="mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
        Keep your daily habits and your yearly dreams in one cosy place, and let your pup cheer
        every paw print.
      </p>
      <Button asChild>
        <Link to="/login">Sign in</Link>
      </Button>
    </section>
  );
}
