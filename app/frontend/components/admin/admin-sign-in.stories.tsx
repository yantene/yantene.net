import { AdminSignIn } from "./admin-sign-in";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 儀式そのものは認証器を呼ぶので Storybook では進まない。ここで確かめるのは、
 * サインインの呼びかけと、その下に畳んである bootstrap の入口との強弱。
 *
 * **開いているかどうかを先に知らせない**作りなので、鍵が 0 本の環境でも 1 本以上の
 * 環境でも見た目は同じになる (ADR 0036)。
 */
const meta: Meta<typeof AdminSignIn> = {
  title: "Admin/AdminSignIn",
  component: AdminSignIn,
  args: { onSignedIn: () => undefined },
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

/** 既定。passkey で入るボタンと、畳んだ登録の入口。 */
export const Default: Story = {};
