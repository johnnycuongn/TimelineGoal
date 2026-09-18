import { createBrowserRouter } from "react-router";
import AppShell from "@/components/app-shell";
import RouteErrorPanel from "@/components/error-panel";
import LandingPage from "@/pages/landing";

function Placeholder({ title }: { title: string }) {
  return (
    <section className="page-wrap py-10">
      <h1 className="display-title text-3xl">{title}</h1>
    </section>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteErrorPanel />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/login", element: <Placeholder title="Login" /> },
      { path: "/pair", element: <Placeholder title="Pair" /> },
      { path: "/den", element: <Placeholder title="Den" /> },
      { path: "/goals", element: <Placeholder title="Timeline" /> },
      { path: "/us", element: <Placeholder title="Us" /> },
    ],
  },
]);
