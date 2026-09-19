import { isRouteErrorResponse, useRouteError } from "react-router";

/** A PostgrestError is a plain object, so `String(error)` alone says "[object Object]". */
function readMessage(error: unknown): string {
  const direct = error instanceof Error ? error.message : (error as { message?: unknown })?.message;
  return typeof direct === "string" && direct.length > 0 ? direct : String(error);
}

// A <section>, not a <main>: on an app route this renders inside AppShell's <main>,
// and RouteErrorPanel (which renders outside the shell) supplies its own.
export function ErrorPanel({ error }: { error: unknown }) {
  const message = readMessage(error);
  return (
    <section className="page-wrap px-4 py-12">
      <section className="island-shell max-w-3xl p-6 sm:p-8">
        <p className="island-kicker mb-3">Hmm</p>
        <h1 className="display-title mb-4 text-3xl">We couldn't reach the den</h1>
        <p className="m-0 text-muted-foreground text-sm leading-7">
          Usually this means the database is asleep or the connection dropped. Pull to refresh, or
          try again in a moment.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-muted p-3 text-xs">{message}</pre>
      </section>
    </section>
  );
}

export default function RouteErrorPanel() {
  const error = useRouteError();
  const shown = isRouteErrorResponse(error)
    ? new Error(`${error.status} ${error.statusText}`)
    : error;
  return (
    <main>
      <ErrorPanel error={shown} />
    </main>
  );
}
