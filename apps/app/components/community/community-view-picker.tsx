"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/design-system/components/ui/drawer";
import {
  BookmarkIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  CompassIcon,
  FileTextIcon,
  type LucideIcon,
  UsersRoundIcon,
} from "lucide-react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import type { CommunityView } from "./community-views";
import { communityViews } from "./community-views";

const viewIcons: Record<CommunityView, LucideIcon> = {
  explore: CompassIcon,
  groups: UsersRoundIcon,
  meetings: CalendarDaysIcon,
  saved: BookmarkIcon,
  mine: FileTextIcon,
};

const CommunityViewPicker = ({
  activeView,
}: {
  readonly activeView: (typeof communityViews)[number];
}) => (
  <div className="community-view-picker">
    <Drawer>
      <DrawerTrigger asChild>
        <button
          aria-label={`Visão da comunidade: ${activeView.label}`}
          className="community-view-trigger"
          type="button"
        >
          <span>{activeView.label}</span>
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="community-view-sheet">
        <DrawerHeader className="community-view-sheet__header">
          <DrawerTitle>Escolha uma visão</DrawerTitle>
        </DrawerHeader>
        <div className="community-view-sheet__options">
          {communityViews.map((view) => {
            const Icon = viewIcons[view.value];
            const selected = view.value === activeView.value;
            return (
              <DrawerClose asChild key={view.value}>
                <IntentLink
                  aria-current={selected ? "page" : undefined}
                  className="community-view-sheet__option"
                  href={view.href}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  <span>{view.label}</span>
                  {selected ? (
                    <CheckIcon
                      aria-hidden="true"
                      className="community-view-sheet__check size-4"
                    />
                  ) : null}
                </IntentLink>
              </DrawerClose>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  </div>
);

export default CommunityViewPicker;
