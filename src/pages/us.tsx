import { Copy } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import ColorPicker from "@/components/color-picker";
import PartnerDot from "@/components/partner-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDen } from "@/data/den-context";
import { mintInviteCode, updateCouple, updateMember } from "@/data/mutations";
import { localDayKey } from "@/lib/day";
import { DISPLAY_NAME_MAX, MAX_MEMBERS, type PartnerColorKey, PUP_NAME_MAX } from "@/lib/domain";
import { daysBetween } from "@/lib/periods";

export default function UsPage() {
  const { me, refresh } = useDen();
  const { couple } = me;
  const self = me.members.find((m) => m.id === me.userId);
  const [pupName, setPupName] = useState(couple.pupName ?? "");
  const [displayName, setDisplayName] = useState(self?.displayName ?? "");
  const [anniversary, setAnniversary] = useState(couple.anniversary ?? "");
  const [busy, setBusy] = useState(false);

  const save = useCallback(
    async (work: () => Promise<void>, done: string) => {
      setBusy(true);
      try {
        await work();
        await refresh();
        toast(done);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save.");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void save(async () => {
        await updateCouple(couple.id, { pupName, anniversary: anniversary || null });
        await updateMember(me.userId, { displayName });
      }, "Saved");
    },
    [save, couple.id, pupName, anniversary, me.userId, displayName],
  );
  const onColor = useCallback(
    (key: PartnerColorKey) => {
      void save(() => updateMember(me.userId, { color: key }), "Colour updated");
    },
    [save, me.userId],
  );
  const onPupName = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setPupName(e.target.value),
    [],
  );
  const onDisplayName = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value),
    [],
  );
  const onAnniversary = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setAnniversary(e.target.value),
    [],
  );
  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(couple.inviteCode ?? "");
    toast("Code copied");
  }, [couple.inviteCode]);
  const mintCode = useCallback(() => {
    void save(async () => {
      await mintInviteCode();
    }, "New code minted");
  }, [save]);

  if (!self) {
    return null;
  }

  const daysOfUs = couple.anniversary ? daysBetween(couple.anniversary, localDayKey()) : null;
  const taken = me.members.filter((m) => m.id !== self.id).map((m) => m.color);

  return (
    <section className="page-wrap space-y-6 py-8 sm:py-10">
      <div>
        <p className="island-kicker mb-2">Us</p>
        <h1 className="display-title text-3xl sm:text-4xl">
          {me.members.map((m) => m.displayName).join(" & ")}
        </h1>
        {daysOfUs !== null ? <p className="text-muted-foreground">{daysOfUs} days of us</p> : null}
      </div>

      <Card>
        <CardHeader>
          <h2 className="display-title text-2xl">Our den</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="pup">Pup name</Label>
              <Input id="pup" maxLength={PUP_NAME_MAX} onChange={onPupName} value={pupName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="me">Your name</Label>
              <Input
                id="me"
                maxLength={DISPLAY_NAME_MAX}
                onChange={onDisplayName}
                value={displayName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anniversary">Anniversary</Label>
              <Input id="anniversary" onChange={onAnniversary} type="date" value={anniversary} />
            </div>
            <div className="flex items-end">
              <Button className="w-full sm:w-auto" disabled={busy} type="submit">
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="display-title text-2xl">Colours</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {me.members.map((m) => (
              <span className="flex items-center gap-2 text-sm" key={m.id}>
                <PartnerDot color={m.color} label={m.displayName} /> {m.displayName}
              </span>
            ))}
          </div>
          <ColorPicker onChange={onColor} taken={taken} value={self.color} />
        </CardContent>
      </Card>

      {me.members.length < MAX_MEMBERS ? (
        <Card>
          <CardHeader>
            <h2 className="display-title text-2xl">Waiting for your partner</h2>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="font-heading text-3xl tracking-[0.3em]">
              {couple.inviteCode ?? "······"}
            </span>
            <Button onClick={copyCode} type="button" variant="outline">
              <Copy /> Copy
            </Button>
            <Button disabled={busy} onClick={mintCode} type="button" variant="ghost">
              Mint a new code
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="display-title text-2xl">About our pup</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground text-sm">
          <p>
            "Bulldog Puppy" by{" "}
            <a
              className="underline"
              href="https://sketchfab.com/3d-models/bulldog-puppy-7081c9c27df244bf84774361888f58a2"
              rel="noopener noreferrer"
              target="_blank"
            >
              doinspire
            </a>
            , licensed under{" "}
            <a
              className="underline"
              href="https://creativecommons.org/licenses/by/4.0/"
              rel="noopener noreferrer"
              target="_blank"
            >
              CC BY 4.0
            </a>
            .
          </p>
          <p>
            Skeleton and animations from the Ultimate Animated Animal Pack by{" "}
            <a
              className="underline"
              href="https://quaternius.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              Quaternius
            </a>{" "}
            (CC0). Thank you.
          </p>
          <p>Leaving a den isn't built yet. If you need it, tell us.</p>
        </CardContent>
      </Card>
    </section>
  );
}
