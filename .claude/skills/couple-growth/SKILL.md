---
name: couple-growth
description: Use when designing or changing anything about goals, check-ins, rewards, streaks, notifications, partner visibility, or Corner decisions in TimelineGoal — any feature touching how the couple interacts, commits, or progresses together.
---

# TimelineGoal Couple-Growth Spec

The app exists to help two people grow a life together. Every mechanic must strengthen "us", never score one partner against the other.

## Non-Negotiable Principles

1. **Two people, one world.** Exactly two members per couple. All goals — personal and shared — are visible to both. There is no private mode; transparency is the product.
2. **Never compare partners.** No leaderboards, no "who did more", no partner-vs-partner stats. The only score is the life being built. Both partners' colors always *combine* (gradients, arcs meeting in the middle), never compete.
3. **Cheerleader, not chore.** The bulldog reacts to progress; he never demands care. Nothing decays, nothing is lost by being away. Skipped weeks are quiet facts, not punished failures.
4. **Cosmetics-only rewards.** Milestones unlock bandanas, den decorations, doodle styles. No points, levels, currencies, or paywalled affection.
5. **Small taps feed the big dream.** The ladder (weekly → quarterly → yearly) must stay visible: every check-in visibly nudges its parent. A weekly goal without a felt connection to something bigger is a design smell — offer linking at creation.
6. **Commitment is a ritual.** Shared goals deserve a moment: the two-person seal. Big decisions in Corners get the ⭐ stamp and a one-tap "Make it a goal →" path. Discussion → decision → commitment should never lose momentum.
7. **Presence over pressure.** Ambient partner signals (pulse, ticker, flick-a-heart reactions) make the app feel inhabited by two. Notifications are warm, optional, from the bulldog's voice — never streak-shaming, never more than one nudge per day.

## Mechanic Design Test

Before shipping any goal/check-in/reward mechanic, it must pass all four:

- **Together test**: does it give the couple a reason to interact, not just track?
- **Guilt test**: if a couple ignores the app for two weeks, does returning feel welcoming?
- **Fairness test**: does it stay kind when one partner is busier than the other?
- **Story test**: does progress read as a shared story (history, doodles, recap) rather than a metric?

## Data Rules That Protect These Principles

- Check-ins are **append-only events** with `uid` — history is a keepsake (future yearly recap), never rewritten
- `owner: uidA | uidB | 'shared'` — shared goals need both for the seal, either can check in
- Periods (ISO week/quarter/year) archive automatically — old goals become memories, not clutter
- Everything lives under `couples/{coupleId}` with membership-only access — the couple's world is theirs alone

## Red Flags

- A feature that makes sense for one user alone (why is it in a couple's app?)
- Any stat that ranks partners, any red "failed" state, any loss mechanic
- A reward that isn't cosmetic/memory-based
- A notification a partner could read as a complaint about them
- A decision flow in Corners that dead-ends without an optional path to a goal
