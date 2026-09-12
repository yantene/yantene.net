import { RegisterPasskey } from "./register-passkey";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 出す欄がサインインの有無で変わる。トークンが要るのは最初の 1 本だけで、
 * それ以降はサインインしていることが条件になる (ADR 0036)。
 */
const meta: Meta<typeof RegisterPasskey> = {
  title: "Admin/RegisterPasskey",
  component: RegisterPasskey,
  args: { onRegistered: () => undefined },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** サインイン中。端末を足す経路なので、名前だけを訊く。 */
export const SignedIn: Story = {
  args: { signedIn: true },
};

/** 最初の 1 本 (bootstrap)。登録用のトークンの欄が出る。 */
export const Bootstrap: Story = {
  args: { signedIn: false },
};
