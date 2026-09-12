import { CredentialList } from "./credential-list";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 取り消しは fetch を叩くので、ここで確かめられるのは並びと「押せるかどうか」まで。
 * 最後の 1 本を取り消させない判断はサーバーにもあり (ADR 0036)、ここはその説明を
 * 先に出すためのもの。
 */
const meta: Meta<typeof CredentialList> = {
  title: "Admin/CredentialList",
  component: CredentialList,
  args: {
    onChange: () => undefined,
    credentials: [
      {
        id: "Y3JlZC1vbmU",
        label: "MacBook の Touch ID",
        algorithm: "ES256",
        backedUp: true,
        createdAt: "2026-09-01T10:00:00Z",
        lastUsedAt: "2026-09-12T08:30:00Z",
        current: true,
      },
      {
        id: "Y3JlZC10d28",
        label: "YubiKey",
        algorithm: "ES256",
        backedUp: false,
        createdAt: "2026-09-02T11:00:00Z",
        lastUsedAt: null,
        current: false,
      },
    ],
  },
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

/** 2 本あるので、どちらも取り消せる。 */
export const Several: Story = {};

/** 1 本だけ。取り消しは押せず、理由を添える。 */
export const LastOne: Story = {
  args: { credentials: [meta.args?.credentials?.[0] as never] },
};

/** まだ 1 本も無い (bootstrap の直前)。 */
export const Empty: Story = {
  args: { credentials: [] },
};

/** 同期されない、端末に閉じた鍵だけのとき。 */
export const DeviceBound: Story = {
  args: { credentials: [meta.args?.credentials?.[1] as never] },
};
