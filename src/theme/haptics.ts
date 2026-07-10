/**
 * Haptic tiers (see .claude/skills/motion-spec). Every celebratory moment gets a haptic;
 * a new celebration with no haptic is a red flag.
 *
 * tick        → press, paw stamp            (selection)
 * success     → goal unit done, seal armed  (notification success)
 * celebration → goal complete, seal slam    (heavy impact ×2)
 *
 * All calls are fire-and-forget and safe on web / unsupported devices (errors swallowed).
 */

import * as Haptics from 'expo-haptics';

function safe(run: () => Promise<void>) {
  run().catch(() => {
    /* haptics unsupported (web/simulator) — non-fatal */
  });
}

export const haptics = {
  tick() {
    safe(() => Haptics.selectionAsync());
  },
  success() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  celebration() {
    safe(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    });
  },
};
