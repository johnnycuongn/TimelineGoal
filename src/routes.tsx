import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/auth/auth-provider";
import AppShell from "@/components/app-shell";
import RouteErrorPanel, { ErrorPanel } from "@/components/error-panel";
import { DenContext, type DenValue } from "@/data/den-context";
import { useMe } from "@/data/use-me";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import PairPage from "@/pages/pair";
import TimelinePage from "@/pages/timeline";
import UsPage from "@/pages/us";

function Loading() {
  return (
    <section className="page-wrap py-16">
      <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-muted" />
    </section>
  );
}

/** Signed-in users only. */
function RequireSession() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return <Loading />;
  }
  if (status === "signed-out") {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }
  return <Outlet />;
}

/** Signed-in users with a den. Provides `me` (with a non-null couple) to pages. */
function RequireDen() {
  const { me, error, isLoading, refresh } = useMe();
  // Data first, as in SignedOutOnly: `me` stays in the SWR cache, so a failed background
  // revalidation must not blank a working den — only a cold who-am-I failure shows the panel.
  if (error && !me) {
    return <ErrorPanel error={error} />;
  }
  if (isLoading || !me) {
    return <Loading />;
  }
  if (!me.couple) {
    return <Navigate replace to="/pair" />;
  }
  const value: DenValue = { me: { ...me, couple: me.couple }, refresh };
  return (
    <DenContext.Provider value={value}>
      <Outlet />
    </DenContext.Provider>
  );
}

/** Landing and login: a signed-in visitor goes straight to their den (or to pairing). */
function SignedOutOnly() {
  const { status } = useAuth();
  const { me, error, isLoading } = useMe();
  // Data first: a stale SWR error alongside usable data must not block the redirect.
  if (status === "signed-in" && me) {
    return <Navigate replace to={me.couple ? "/den" : "/pair"} />;
  }
  // A failed who-am-I must not leave the PWA start URL on an endless skeleton.
  if (status === "signed-in" && error) {
    return <ErrorPanel error={error} />;
  }
  if (status === "loading" || (status === "signed-in" && (isLoading || !me))) {
    return <Loading />;
  }
  return <Outlet />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="page-wrap py-10">
      <h1 className="display-title text-3xl">{title}</h1>
    </section>
  );
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPanel />,
    children: [
      {
        element: <AppShell showNav={false} />,
        children: [
          {
            element: <SignedOutOnly />,
            children: [
              { path: "/", element: <LandingPage /> },
              { path: "/login", element: <LoginPage /> },
            ],
          },
          {
            element: <RequireSession />,
            children: [{ path: "/pair", element: <PairPage /> }],
          },
        ],
      },
      {
        element: <AppShell />,
        children: [
          {
            element: <RequireSession />,
            children: [
              {
                element: <RequireDen />,
                children: [
                  { path: "/den", element: <Placeholder title="Den" /> },
                  { path: "/goals", element: <TimelinePage /> },
                  { path: "/us", element: <UsPage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate replace to="/" /> },
    ],
  },
]);
