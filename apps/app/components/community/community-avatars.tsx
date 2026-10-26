"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { useEffect, useRef, useState } from "react";

const MAX_VISIBLE_AVATARS = 7;
const MIN_SWAP_MS = 5000;
const MAX_SWAP_MS = 8000;
const FADE_MS = 600;

export interface CommunityAvatarVisual {
  readonly avatarUrl: string | null;
  readonly initials: string;
}

/** The first window of the (already shuffled) pool, used for the first paint. */
export const initialCommunityAvatarSlots = (
  avatars: readonly CommunityAvatarVisual[]
) => avatars.slice(0, MAX_VISIBLE_AVATARS).map((_, index) => index);

/**
 * Picks the avatar for the next swap. It never repeats a person that is
 * already on screen, so the same face cannot sit in two positions.
 */
export const pickCommunityAvatarSwap = (
  poolSize: number,
  slots: readonly number[],
  random: () => number = Math.random
) => {
  const free = Array.from({ length: poolSize }, (_, index) => index).filter(
    (index) => !slots.includes(index)
  );
  if (free.length === 0 || slots.length === 0) {
    return null;
  }
  return {
    avatar: free[Math.floor(random() * free.length)] as number,
    slot: Math.floor(random() * slots.length),
  };
};

const AvatarFace = ({ avatar }: { readonly avatar: CommunityAvatarVisual }) => (
  <Avatar className="community-avatars__image">
    {avatar.avatarUrl ? (
      <AvatarImage alt="" loading="lazy" src={avatar.avatarUrl} />
    ) : null}
    <AvatarFallback className="community-avatars__fallback">
      {avatar.initials}
    </AvatarFallback>
  </Avatar>
);

export const CommunityAvatars = ({
  avatars,
}: {
  readonly avatars: readonly CommunityAvatarVisual[];
}) => {
  const [slots, setSlots] = useState<number[]>(() =>
    initialCommunityAvatarSlots(avatars)
  );
  // The face that was just replaced stays under the new one while it fades.
  const [leaving, setLeaving] = useState<Record<number, number>>({});
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  useEffect(() => {
    setSlots(initialCommunityAvatarSlots(avatars));
    setLeaving({});
    if (avatars.length <= MAX_VISIBLE_AVATARS) {
      return;
    }

    const timers = new Set<number>();
    let stopped = false;
    const schedule = () => {
      if (stopped || document.visibilityState !== "visible") {
        return;
      }
      const delay = MIN_SWAP_MS + Math.random() * (MAX_SWAP_MS - MIN_SWAP_MS);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        const swap = pickCommunityAvatarSwap(avatars.length, slotsRef.current);
        if (swap) {
          const previous = slotsRef.current[swap.slot] as number;
          setLeaving((current) => ({ ...current, [swap.slot]: previous }));
          setSlots((current) =>
            current.map((value, index) =>
              index === swap.slot ? swap.avatar : value
            )
          );
          const cleanup = window.setTimeout(() => {
            timers.delete(cleanup);
            setLeaving((current) => {
              const next = { ...current };
              delete next[swap.slot];
              return next;
            });
          }, FADE_MS);
          timers.add(cleanup);
        }
        schedule();
      }, delay);
      timers.add(timer);
    };
    const clear = () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
    const sync = () => {
      clear();
      schedule();
    };

    document.addEventListener("visibilitychange", sync);
    schedule();
    return () => {
      stopped = true;
      clear();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [avatars]);

  return (
    <div
      aria-hidden="true"
      className="community-avatars"
      data-testid="community-avatars"
    >
      {slots.map((poolIndex, slot) => {
        const current = avatars[poolIndex];
        const previous =
          leaving[slot] === undefined ? undefined : avatars[leaving[slot]];
        if (!current) {
          return null;
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: each position is a decorative slot; the slot has no local state.
          <span className="community-avatars__item" key={slot}>
            {previous ? (
              <span className="community-avatars__layer community-avatars__layer--out">
                <AvatarFace avatar={previous} />
              </span>
            ) : null}
            <span
              className={
                previous
                  ? "community-avatars__layer community-avatars__layer--in"
                  : "community-avatars__layer"
              }
              key={poolIndex}
            >
              <AvatarFace avatar={current} />
            </span>
          </span>
        );
      })}
    </div>
  );
};
