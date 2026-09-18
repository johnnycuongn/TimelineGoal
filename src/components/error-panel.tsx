import { isRouteErrorResponse, useRouteError } from "react-router";

export function ErrorPanel({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell max-w-3xl p-6 sm:p-8">
        <p className="island-kicker mb-3">Hmm</p>
        <h1 className="display-title mb-4 text-3xl">We couldn't reach the den</h1>
        <p className="m-0 text-muted-foreground text-sm leading-7">
          Usually this means the database is asleep or the connection dropped. Pull to refresh, or
          try again in a moment.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-muted p-3 text-xs">{message}</pre>
      </section>
    </main>
  );
}

export default function RouteErrorPanel() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <ErrorPanel error={new Error(`${error.status} ${error.statusText}`)} />;
  }
  return <ErrorPanel error={error} />;
}
