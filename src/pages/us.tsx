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
import { copyWithToast } from "@/lib/clipboard";
import { localDayKey } from "@/lib/day";
import {
  DISPLAY_NAME_MAX,
  denNamesReady,
  MAX_MEMBERS,
  type PartnerColorKey,
  PUP_NAME_MAX,
} from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import { daysBetween } from "@/lib/periods";

const NAMES_NEEDED = "Your pup and you both need a name before we can save.";

interface DenFormValues {
  pupName: string;
  displayName: string;
  anniversary: string;
}

/**
 * The three fields, with their own state so the parent can remount them with a `key`
 * whenever the saved values change. Without that, a partner renaming the pup while this
 * page is open would be quietly overwritten by the next save from here.
 */
function DenForm({
  initial,
  busy,
  onSave,
}: {
  initial: DenFormValues;
  busy: boolean;
  onSave: (values: DenFormValues) => void;
}) {
  const [pupName, setPupName] = useState(initial.pupName);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [anniversary, setAnniversary] = useState(initial.anniversary);

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
  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      // Both columns carry length checks, and the two writes are not one
      // transaction: check before either of them so a save never half-applies.
      if (!denNamesReady(pupName, displayName)) {
        toast.error(NAMES_NEEDED);
        return;
      }
      onSave({ pupName, displayName, anniversary });
    },
    [onSave, pupName, displayName, anniversary],
  );

  const namesReady = denNamesReady(pupName, displayName);
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="pup">Pup name</Label>
        <Input id="pup" maxLength={PUP_NAME_MAX} onChange={onPupName} required value={pupName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="me">Your name</Label>
        <Input
          id="me"
          maxLength={DISPLAY_NAME_MAX}
          onChange={onDisplayName}
          required
          value={displayName}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="anniversary">Anniversary</Label>
        <Input id="anniversary" onChange={onAnniversary} type="date" value={anniversary} />
      </div>
      <div className="flex items-end">
        <Button className="w-full sm:w-auto" disabled={busy || !namesReady} type="submit">
          Save
        </Button>
      </div>
      {namesReady ? null : (
        <p className="text-muted-foreground text-sm sm:col-span-2">{NAMES_NEEDED}</p>
      )}
    </form>
  );
}

export default function UsPage() {
  const { me, refresh } = useDen();
  const { couple } = me;
  const self = me.members.find((m) => m.id === me.userId);
  const [busy, setBusy] = useState(false);

  const save = useCallback(
    async (work: () => Promise<void>, done: string) => {
      setBusy(true);
      try {
        await work();
        await refresh();
        toast(done);
      } catch (err) {
        toast.error(friendlyError(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const onSave = useCallback(
    (values: DenFormValues) => {
      void save(async () => {
        await updateCouple(couple.id, {
          pupName: values.pupName.trim(),
          anniversary: values.anniversary || null,
        });
        await updateMember(me.userId, { displayName: values.displayName.trim() });
      }, "Saved");
    },
    [save, couple.id, me.userId],
  );
  const onColor = useCallback(
    (key: PartnerColorKey) => {
      void save(() => updateMember(me.userId, { color: key }), "Colour updated");
    },
    [save, me.userId],
  );
  const inviteCode = couple.inviteCode;
  const copyCode = useCallback(() => {
    if (inviteCode === null) {
      return;
    }
    void copyWithToast(inviteCode, "Code copied");
  }, [inviteCode]);
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
          {/* Remounts whenever a saved value changes, here or from the partner's phone. */}
          <DenForm
            busy={busy}
            initial={{
              pupName: couple.pupName ?? "",
              displayName: self.displayName,
              anniversary: couple.anniversary ?? "",
            }}
            key={`${couple.pupName ?? ""}|${self.displayName}|${couple.anniversary ?? ""}`}
            onSave={onSave}
          />
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
            <span className="font-heading text-3xl tracking-[0.3em]">{inviteCode ?? "······"}</span>
            <Button
              disabled={inviteCode === null}
              onClick={copyCode}
              type="button"
              variant="outline"
            >
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
              className="focus-ring rounded-sm underline"
              href="https://sketchfab.com/3d-models/bulldog-puppy-7081c9c27df244bf84774361888f58a2"
              rel="noopener noreferrer"
              target="_blank"
            >
              doinspire
            </a>
            , licensed under{" "}
            <a
              className="focus-ring rounded-sm underline"
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
              className="focus-ring rounded-sm underline"
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
