import { SignInForm } from "./sign-in-form";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SignInForm> = {
  title: "SignIn/SignInForm",
  component: SignInForm,
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

export const Default: Story = {
  args: { invalid: false },
};

export const Invalid: Story = {
  args: { invalid: true },
};
