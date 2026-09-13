import { SignInState } from "./sign-in-state";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SignInState> = {
  title: "Layout/SignInState",
  component: SignInState,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 読み手の大半が見る側。SSR が描くのもこちら。 */
export const SignedOut: Story = {
  args: { signedIn: false },
};

export const SignedIn: Story = {
  args: { signedIn: true },
};
