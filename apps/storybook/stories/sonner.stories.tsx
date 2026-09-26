import { Toaster } from "@repo/design-system/components/ui/sonner";
import { toast } from "@repo/design-system/lib/toast";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * An opinionated toast component for React.
 */
const meta: Meta<typeof Toaster> = {
  title: "ui/Sonner",
  component: Toaster,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default form of the toaster.
 */
export const Default: Story = {
  render: () => (
    <div className="flex min-h-96 items-center justify-center space-x-2">
      <button
        onClick={() => toast.success("Event has been created")}
        type="button"
      >
        Show Toast
      </button>
      <Toaster />
    </div>
  ),
};
