import { BellRing, Share } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDen } from "@/data/den-context";
import { savePushSubscription, updateNotificationPrefs } from "@/data/notification-mutations";
import { useNotificationPrefs } from "@/data/use-notification-prefs";
import { useIsStandalone } from "@/hooks/use-is-standalone";
import type { NotificationKind, NotificationPrefs } from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import {
  browserTimezone,
  currentSubscription,
  type PushSupport,
  pushSupport,
  readPushEnv,
  subscribe,
  subscriptionKeys,
} from "@/lib/push";

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

interface Toggle {
  kind: NotificationKind;
  label: (partner: string) => string;
}

const GROUPS: { title: string; toggles: Toggle[] }[] = [
  {
    title: "Paws",
    toggles: [
      { kind: "paw_shared", label: (p) => `${p} paws a shared goal` },
      { kind: "paw_own", label: (p) => `${p} paws one of their own` },
      { kind: "milestone_done", label: () => "A milestone is finished" },
    ],
  },
  {
    title: "Den",
    toggles: [
      { kind: "heart", label: (p) => `${p} hearts your paw` },
      { kind: "seal", label: (p) => `${p} seals a goal you made` },
      { kind: "goal_added", label: (p) => `${p} adds a goal` },
      { kind: "goal_archived", label: (p) => `${p} tucks a goal away` },
      { kind: "partner_joined", label: () => "Your partner joins the den" },
    ],
  },
];

async function turnOn(): Promise<void> {
  if (!VAPID_KEY) {
    throw new Error("Notifications aren't set up on this site yet.");
  }
  // iOS only shows the prompt from inside a tap; this runs in the click handler.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications stay off until you allow them.");
  }
  const sub = await subscribe(VAPID_KEY);
  await savePushSubscription(subscriptionKeys(sub), navigator.userAgent, browserTimezone());
}

function Toggles({
  prefs,
  partner,
  busy,
  onMuted,
  onRemindAt,
}: {
  prefs: NotificationPrefs;
  partner: string;
  busy: boolean;
  onMuted: (kind: NotificationKind, on: boolean) => void;
  onRemindAt: (value: string) => void;
}) {
  const [remindAt, setRemindAt] = useState(prefs.remindAt);
  const onTime = useCallback((e: ChangeEvent<HTMLInputElement>) => setRemindAt(e.target.value), []);
  const onTimeDone = useCallback(() => {
    if (remindAt !== prefs.remindAt) {
      onRemindAt(remindAt);
    }
  }, [remindAt, prefs.remindAt, onRemindAt]);
  const on = (kind: NotificationKind) => !prefs.muted.includes(kind);

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <fieldset className="space-y-3" key={group.title}>
          <legend className="mb-2 font-semibold text-muted-foreground text-sm">
            {group.title}
          </legend>
          {group.toggles.map((t) => (
            <div className="flex items-center justify-between gap-4" key={t.kind}>
              <Label className="font-normal text-base" htmlFor={`notify-${t.kind}`}>
                {t.label(partner)}
              </Label>
              <Switch
                checked={on(t.kind)}
                disabled={busy}
                id={`notify-${t.kind}`}
                onCheckedChange={(checked) => onMuted(t.kind, checked)}
              />
            </div>
          ))}
        </fieldset>
      ))}
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-muted-foreground text-sm">Reminder</legend>
        <div className="flex items-center justify-between gap-4">
          <Label className="font-normal text-base" htmlFor="notify-reminder">
            Nudge me if I have paws left
          </Label>
          <Switch
            checked={on("reminder")}
            disabled={busy}
            id="notify-reminder"
            onCheckedChange={(checked) => onMuted("reminder", checked)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="font-normal text-base" htmlFor="notify-remind-at">
            At
          </Label>
          <Input
            className="w-36"
            disabled={busy || !on("reminder")}
            id="notify-remind-at"
            onBlur={onTimeDone}
            onChange={onTime}
            step={900}
            type="time"
            value={remindAt}
          />
        </div>
      </fieldset>
    </div>
  );
}

export default function NotificationsCard() {
  const { me } = useDen();
  const standalone = useIsStandalone();
  const { prefs, refresh } = useNotificationPrefs();
  const [support, setSupport] = useState<PushSupport>(() => pushSupport(readPushEnv(standalone)));
  const [busy, setBusy] = useState(false);
  const partner = me.members.find((m) => m.id !== me.userId)?.displayName ?? "Your partner";

  useEffect(() => {
    setSupport(pushSupport(readPushEnv(standalone)));
  }, [standalone]);

  // Allowed on this phone but no row for this account (e.g. the other account signed out
  // here): quietly sign the phone back up.
  useEffect(() => {
    if (support !== "granted" || !VAPID_KEY || prefs === undefined) {
      return;
    }
    let cancelled = false;
    (async () => {
      const existing = await currentSubscription();
      if (cancelled || (existing && prefs)) {
        return;
      }
      const sub = existing ?? (await subscribe(VAPID_KEY));
      await savePushSubscription(subscriptionKeys(sub), navigator.userAgent, browserTimezone());
      await refresh();
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [support, prefs, refresh]);

  const onTurnOn = useCallback(async () => {
    setBusy(true);
    try {
      await turnOn();
      await refresh();
      toast("Notifications on");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSupport(pushSupport(readPushEnv(standalone)));
      setBusy(false);
    }
  }, [refresh, standalone]);

  const save = useCallback(
    async (patch: { muted?: NotificationKind[]; remindAt?: string }) => {
      setBusy(true);
      try {
        await updateNotificationPrefs(me.userId, patch);
        await refresh();
      } catch (err) {
        toast.error(friendlyError(err));
      } finally {
        setBusy(false);
      }
    },
    [me.userId, refresh],
  );
  const onMuted = useCallback(
    (kind: NotificationKind, on: boolean) => {
      if (!prefs) {
        return;
      }
      const muted = on ? prefs.muted.filter((k) => k !== kind) : [...prefs.muted, kind];
      void save({ muted });
    },
    [prefs, save],
  );
  const onRemindAt = useCallback((remindAt: string) => void save({ remindAt }), [save]);

  return (
    <Card>
      <CardHeader>
        <h2 className="display-title text-2xl">Notifications</h2>
      </CardHeader>
      <CardContent>
        {support === "needs-install" ? (
          <p className="m-0 flex items-start gap-3 text-sm">
            <Share aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              Add CoupleGoal to your Home Screen to get notifications: tap <strong>Share</strong>,
              then <strong>Add to Home Screen</strong>, and open it from there.
            </span>
          </p>
        ) : null}
        {support === "unsupported" ? (
          <p className="m-0 text-muted-foreground text-sm">
            This browser can't show notifications.
          </p>
        ) : null}
        {support === "denied" ? (
          <p className="m-0 text-muted-foreground text-sm">
            Notifications are off for CoupleGoal. Turn them on in Settings → Notifications →
            CoupleGoal.
          </p>
        ) : null}
        {VAPID_KEY && support === "default" ? (
          <div className="space-y-3">
            <p className="m-0 text-muted-foreground text-sm">
              Hear about {partner}'s paws, hearts and new goals, and get a nudge when you have paws
              left.
            </p>
            <Button disabled={busy} onClick={onTurnOn} type="button">
              <BellRing /> Turn on notifications
            </Button>
          </div>
        ) : null}
        {!VAPID_KEY && (support === "default" || support === "granted") ? (
          <p className="m-0 text-muted-foreground text-sm">
            Notifications aren't set up on this site yet.
          </p>
        ) : null}
        {VAPID_KEY && support === "granted" && prefs ? (
          <Toggles
            busy={busy}
            key={prefs.remindAt}
            onMuted={onMuted}
            onRemindAt={onRemindAt}
            partner={partner}
            prefs={prefs}
          />
        ) : null}
        {VAPID_KEY && support === "granted" && !prefs ? (
          <p className="m-0 text-muted-foreground text-sm">Setting up this phone…</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
