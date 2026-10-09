"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

interface CommunityDisclosureProperties {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
}

export const CommunityDisclosure = ({
  children,
  className = "",
  label,
}: CommunityDisclosureProperties) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  return (
    <div
      className={`community-rail__context ${className}`}
      data-expanded={isExpanded}
    >
      <button
        aria-controls={contentId}
        aria-expanded={isExpanded}
        className="community-rail__context-trigger"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        type="button"
      >
        {label}
      </button>
      <div className="community-rail__context-content" id={contentId}>
        {children}
      </div>
    </div>
  );
};
