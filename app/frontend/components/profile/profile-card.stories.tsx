import { ProfileCard } from "./profile-card";
import { sampleProfile } from "./profile-fixture";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ProfileCard> = {
  title: "Profile/ProfileCard",
  component: ProfileCard,
  args: { profile: sampleProfile },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl px-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 顔写真をまだ置いていないとき。名前と自己紹介だけで成り立つ。 */
export const WithoutAvatar: Story = {
  args: { profile: { ...sampleProfile, avatarUrl: null } },
};

/** 出ていく先を 1 つも書いていないとき。空の並びは出さない。 */
export const WithoutSocials: Story = {
  args: { profile: { ...sampleProfile, socials: [] } },
};

/** 生年月日も出身地も書いていないとき。ラベルだけの行は出さない。 */
export const WithoutBirthFacts: Story = {
  args: { profile: { ...sampleProfile, dateOfBirth: null, birthplace: null } },
};

/** 片方だけ書いたとき。書いてある欄だけが並ぶ。 */
export const WithoutBirthplace: Story = {
  args: { profile: { ...sampleProfile, birthplace: null } },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
