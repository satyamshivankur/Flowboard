import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Trash2 } from "lucide-react";

import { Button, type ButtonVariant } from "./Button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Create task" },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {VARIANTS.map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm" variant="primary">
        Small
      </Button>
      <Button {...args} size="md" variant="primary">
        Medium
      </Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary" icon={Plus}>
        Leading
      </Button>
      <Button {...args} variant="secondary" icon={Plus} iconPosition="trailing">
        Trailing
      </Button>
      <Button {...args} variant="danger" icon={Trash2}>
        Delete
      </Button>
    </div>
  ),
};

/**
 * The spinner replaces the leading icon rather than being appended, so the
 * button keeps its width and the layout around it does not shift mid-request.
 */
export const LoadingAndDisabled: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {VARIANTS.map((variant) => (
          <Button key={variant} {...args} variant={variant} loading>
            Saving
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {VARIANTS.map((variant) => (
          <Button key={variant} {...args} variant={variant} disabled>
            Disabled
          </Button>
        ))}
      </div>
    </div>
  ),
};

export const FullWidth: Story = {
  args: { variant: "primary", fullWidth: true, icon: Plus },
  parameters: { viewport: { defaultViewport: "phone" } },
};
