import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_MIN = 6;

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onEmail = useCallback((e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value), []);
  const onPassword = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
    [],
  );
  const toggleMode = useCallback(() => {
    setMode((m) => (m === "in" ? "up" : "in"));
    setError(null);
  }, []);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        if (mode === "in") {
          await signIn(email.trim(), password);
        } else {
          await signUp(email.trim(), password);
        }
        // /pair forwards fully paired couples to the Den.
        navigate("/pair", { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [mode, email, password, signIn, signUp, navigate],
  );

  return (
    <section className="page-wrap flex min-h-[70dvh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="island-kicker mb-2">Welcome</p>
          <h1 className="display-title text-3xl">
            {mode === "in" ? "Sign in to your den" : "Make your account"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {mode === "in"
              ? "Your pup has been waiting."
              : "One account each; you'll pair up next."}
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                inputMode="email"
                onChange={onEmail}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                id="password"
                minLength={PASSWORD_MIN}
                onChange={onPassword}
                required
                type="password"
                value={password}
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" disabled={busy} type="submit">
              {mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <Button className="mt-3 w-full" onClick={toggleMode} type="button" variant="ghost">
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
