import { Copy } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import Ticker from "@/components/den/ticker";
import TodayStrip from "@/components/den/today-strip";
import { ErrorPanel } from "@/components/error-panel";
import InstallHint from "@/components/install-hint";
import { colorFor } from "@/components/partner-dot";
import Pup from "@/components/pup/pup";
import { usePupMood } from "@/components/pup/pup-mood-context";
import { usePersistentMood } from "@/components/pup/use-persistent-mood";
import { Button } from "@/components/ui/button";
import { useDen } from "@/data/den-context";
import { sendHeart } from "@/data/goal-mutations";
import { useCoupleData } from "@/data/use-couple-data";
import { useHabitToggle } from "@/hooks/use-habit-toggle";
import { usePartnerActivity } from "@/hooks/use-partner-activity";
import { usePreloadPup } from "@/hooks/use-preload-pup";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { useToday } from "@/hooks/use-today";
import { copyWithToast } from "@/lib/clipboard";
import { type Goal, MAX_MEMBERS, type Member, type TickerItem } from "@/lib/domain";
import { friendlyError } from "@/lib/errors";
import { checkinFloor } from "@/lib/periods";
import { type DenData, denView } from "@/lib/views";

function WaitingForPartner({ code }: { code: string }) {
  const copy = useCallback(() => {
    void copyWithToast(code, "Code copied");
  }, [code]);
  return (
    <section className="island-shell mb-6 flex flex-wrap items-center gap-3 p-4">
      {/* basis-full keeps the copy on its own line on a phone; the code and Copy wrap under it. */}
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <p className="island-kicker mb-1">Waiting for your partner</p>
        <p className="m-0 text-muted-foreground text-sm">
          Share this code and you'll be in the same den.
        </p>
      </div>
      <span className="font-heading text-2xl tracking-[0.3em]">{code}</span>
      <Button onClick={copy} size="sm" type="button" variant="outline">
        <Copy /> Copy
      </Button>
    </section>
  );
}

function WaitingForMySeal({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return null;
  }
  return (
    <section className="island-shell mb-6 p-4">
      <p className="island-kicker mb-1">Waiting for your paw</p>
      <ul className="m-0 list-none space-y-1 p-0 text-sm">
        {goals.map((g) => (
          <li key={g.id}>
            <Link
              className="focus-ring inline-flex min-h-11 items-center rounded-md underline"
              to={`/goals?h=${g.horizon}`}
            >
              {g.charm ? `${g.charm} ` : ""}
              {g.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DenContent({
  view,
  coupleId,
  refresh,
  inviteCode,
}: {
  view: DenData;
  coupleId: string;
  refresh: () => Promise<unknown>;
  inviteCode: string | null;
}) {
  const theme = useResolvedTheme();
  const ctx = useMemo(() => ({ coupleId, me: view.me, refresh }), [coupleId, view.me, refresh]);
  const { trigger } = usePupMood();
  const onStamped = useCallback(() => trigger("happy"), [trigger]);
  const habitToggle = useHabitToggle(ctx, onStamped);

  // Persistent mood from the couple's activity and the local clock.
  usePersistentMood(view);

  const onPartnerStamp = useCallback(
    (item: TickerItem, member: Member) =>
      toast(`${member.displayName} stamped ${item.goalTitle}`, {
        style: { borderColor: colorFor(member.color, theme) },
      }),
    [theme],
  );
  const onHeart = useCallback(() => {
    toast("Your partner sent you a heart");
    trigger("love");
  }, [trigger]);
  usePartnerActivity(view, { onPartnerStamp, onHeart });

  const heart = useCallback(
    async (item: TickerItem) => {
      try {
        await sendHeart({ checkinId: item.checkinId, uid: view.me, coupleId });
        await refresh();
      } catch (error) {
        toast.error(friendlyError(error, "The heart got lost. Try again?"));
      }
    },
    [view.me, coupleId, refresh],
  );

  const pup = view.pupName ?? "your pup";

  return (
    <section className="page-wrap py-6 sm:py-10">
      <InstallHint />
      <div className="mb-6">
        <Pup name={pup} />
      </div>
      {view.members.length < MAX_MEMBERS && inviteCode ? (
        <WaitingForPartner code={inviteCode} />
      ) : null}
      <WaitingForMySeal goals={view.waitingForMySeal} />
      <div className="mb-10">
        <p className="island-kicker mb-1">Today</p>
        <h1 className="display-title mt-0 mb-4 text-2xl">One paw at a time</h1>
        <TodayStrip
          habits={view.habits}
          me={view.me}
          members={view.members}
          states={view.habitStates}
          toggle={habitToggle}
        />
      </div>
      <div>
        <p className="island-kicker mb-1">Lately</p>
        <h2 className="display-title mt-0 mb-4 text-2xl">Paw prints</h2>
        <Ticker items={view.ticker} me={view.me} members={view.members} onHeart={heart} />
      </div>
    </section>
  );
}

export default function DenPage() {
  const { me } = useDen();
  const today = useToday();
  usePreloadPup();
  // The Den never looks at an older period, so the rolling window is the whole floor.
  const { data, error, refresh } = useCoupleData(me.couple.id, checkinFloor(undefined, today));
  // Only a cold failure blanks the page: with keepPreviousData a failed background
  // revalidation must not throw away a warm Den.
  if (error && !data) {
    return <ErrorPanel error={error} />;
  }
  if (!data) {
    return (
      <section className="page-wrap py-10">
        <div className="h-[280px] animate-pulse rounded-3xl bg-muted" />
      </section>
    );
  }
  const view = denView(data, me.userId, today);
  return (
    <DenContent
      coupleId={me.couple.id}
      inviteCode={data.couple.inviteCode}
      refresh={refresh}
      view={view}
    />
  );
}
