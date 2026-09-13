import { SignInPanel } from "./sign-in-panel";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SignInPanel> = {
  title: "SignIn/SignInPanel",
  component: SignInPanel,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-96 flex-col">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Sent: Story = {
  args: {
    lead: "The link is on its way. Check your mail — and the spam folder, if it is not there.",
  },
};

export const Expired: Story = {
  args: {
    lead: "Enter your email address and a link to sign in will arrive.",
    notice: "This link no longer works. It expires in 15 minutes, and once it is used.",
  },
};
