import { Copy, Heart } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-provider";
import ColorPicker from "@/components/color-picker";
import { ErrorPanel } from "@/components/error-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDen, joinDen, updateCouple } from "@/data/mutations";
import type { Me } from "@/data/queries";
import { useMe } from "@/data/use-me";
import {
  DEFAULT_COLOR_A,
  DISPLAY_NAME_MAX,
  MAX_MEMBERS,
  type PartnerColorKey,
  PUP_NAME_MAX,
} from "@/lib/domain";
import { isValidShareCode, normalizeShareCode } from "@/lib/share-code";

type Step = "choose" | "waiting" | "name";

function initialStepFor(me: Me): Step {
  if (!me.couple) {
    return "choose";
  }
  return me.members.length === MAX_MEMBERS ? "name" : "waiting";
}

export default function PairPage() {
  const { email } = useAuth();
  const { me, error: loadError, isLoading, refresh } = useMe();
  if (loadError) {
    return <ErrorPanel error={loadError} />;
  }
  if (isLoading || !me) {
    return null;
  }
  // Fully paired and the pup is named: nothing left to do here.
  if (me.couple && me.members.length === MAX_MEMBERS && me.couple.pupName) {
    return <Navigate replace to="/den" />;
  }
  return <PairFlow email={email} me={me} refresh={refresh} />;
}

function PairFlow({
  email,
  me,
  refresh,
}: {
  email: string | null;
  me: Me;
  refresh: () => Promise<Me | undefined>;
}) {
  const navigate = useNavigate();
  const self = me.members.find((m) => m.id === me.userId);
  const defaultName = self?.displayName ?? email?.split("@")[0] ?? "";
  const [displayName, setDisplayName] = useState(defaultName);
  const [color, setColor] = useState<PartnerColorKey>(DEFAULT_COLOR_A);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>(() => initialStepFor(me));
  const [inviteCode, setInviteCode] = useState(me.couple?.inviteCode ?? "");
  const [pupName, setPupName] = useState("");

  // The partner joining flips this page from "waiting" to "name" (Realtime is wired in Task 6;
  // until then SWR's focus revalidation catches it).
  useEffect(() => {
    if (step === "waiting" && me.members.length === MAX_MEMBERS) {
      setStep("name");
    }
  }, [step, me.members.length]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onCreate = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void run(async () => {
        const den = await createDen(displayName, color);
        setInviteCode(den.inviteCode);
        await refresh();
        setStep("waiting");
      });
    },
    [run, displayName, color, refresh],
  );

  const onJoin = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void run(async () => {
        if (!isValidShareCode(normalizeShareCode(code))) {
          throw new Error("A share code is 6 letters or digits, like ABC234.");
        }
        await joinDen(code, displayName, color);
        await refresh();
        setStep("name");
      });
    },
    [run, code, displayName, color, refresh],
  );

  const onName = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void run(async () => {
        if (!me.couple) {
          throw new Error("You are not in a den yet.");
        }
        await updateCouple(me.couple.id, { pupName });
        await refresh();
        navigate("/den", { replace: true });
      });
    },
    [run, pupName, me.couple, refresh, navigate],
  );

  const onDisplayName = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value),
    [],
  );
  const onCode = useCallback((e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value), []);
  const onPupName = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setPupName(e.target.value),
    [],
  );
  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(inviteCode);
  }, [inviteCode]);
  const goToDen = useCallback(() => navigate("/den"), [navigate]);

  if (step === "name") {
    return (
      <section className="page-wrap flex min-h-[60dvh] items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="island-kicker mb-2">You're paired</p>
            <h1 className="display-title text-3xl">Name your pup</h1>
            <p className="text-muted-foreground text-sm">
              A bulldog puppy just moved into your den. What do we call them?
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onName}>
              <div className="space-y-2">
                <Label htmlFor="pup-name">Pup name</Label>
                <Input
                  autoComplete="off"
                  id="pup-name"
                  maxLength={PUP_NAME_MAX}
                  onChange={onPupName}
                  placeholder="Mochi"
                  required
                  value={pupName}
                />
              </div>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={busy || pupName.trim().length === 0}
                type="submit"
              >
                Adopt {pupName.trim() || "them"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (step === "waiting") {
    return (
      <section className="page-wrap flex min-h-[60dvh] items-center justify-center py-10">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <p className="island-kicker mb-2">Your den is ready</p>
            <h1 className="display-title text-3xl">Share this code</h1>
            <p className="text-muted-foreground text-sm">
              Your partner enters it on their Pair page and you're in the same den.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-heading text-4xl tracking-[0.3em] sm:text-5xl">{inviteCode}</p>
            <Button onClick={copyCode} type="button" variant="outline">
              <Copy /> Copy code
            </Button>
            <p className="text-muted-foreground text-xs">You can start adding goals now.</p>
            <Button onClick={goToDen} type="button" variant="ghost">
              Go to the Den
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-wrap py-10">
      <div className="mb-8 max-w-2xl">
        <p className="island-kicker mb-2">Two people, one den</p>
        <h1 className="display-title text-4xl">Let's pair up</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="display-title text-2xl">
              <Heart className="mr-2 inline size-5 text-primary" />
              Start our den
            </h2>
            <p className="text-muted-foreground text-sm">You get a share code for your partner.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onCreate}>
              <div className="space-y-2">
                <Label htmlFor="name-create">Your name</Label>
                <Input
                  autoComplete="given-name"
                  id="name-create"
                  maxLength={DISPLAY_NAME_MAX}
                  onChange={onDisplayName}
                  required
                  value={displayName}
                />
              </div>
              <div className="space-y-2">
                <Label>Your colour</Label>
                <ColorPicker onChange={setColor} value={color} />
              </div>
              <Button className="w-full sm:w-auto" disabled={busy} type="submit">
                Create den
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="display-title text-2xl">Join with a code</h2>
            <p className="text-muted-foreground text-sm">
              Got a 6-character code from your partner? If you pick the same colour as them, you'll
              get another.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onJoin}>
              <div className="space-y-2">
                <Label htmlFor="name-join">Your name</Label>
                <Input
                  autoComplete="given-name"
                  id="name-join"
                  maxLength={DISPLAY_NAME_MAX}
                  onChange={onDisplayName}
                  required
                  value={displayName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Share code</Label>
                <Input
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="font-heading text-xl uppercase tracking-[0.3em]"
                  id="code"
                  maxLength={7}
                  onChange={onCode}
                  placeholder="ABC234"
                  required
                  value={code}
                />
              </div>
              <div className="space-y-2">
                <Label>Your colour</Label>
                <ColorPicker onChange={setColor} value={color} />
              </div>
              <Button
                className="w-full sm:w-auto"
                disabled={busy}
                type="submit"
                variant="secondary"
              >
                Join den
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {error ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
