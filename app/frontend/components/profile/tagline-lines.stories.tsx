import { sampleProfile } from "./profile-fixture";
import { TaglineLines } from "./tagline-lines";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof TaglineLines> = {
  title: "Profile/TaglineLines",
  component: TaglineLines,
  args: {
    lines: sampleProfile.tagline,
    className: "max-w-xl text-[0.95rem] leading-relaxed text-foreground/85",
  },
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

/** 1 行だけの自己紹介。改行は挟まない。 */
export const SingleLine: Story = {
  args: { lines: ["Web 屋。星と暦と、手を動かすことが好きです。"] },
};

/**
 * 空行で段落を分けた自己紹介。空いた行がそのまま空いて見えること (行が詰められたり
 * 落とされたりしないこと) の見張り。
 */
export const WithBlankLines: Story = {
  args: { lines: ["Web 屋です。", "", "星と暦が好きです。", "", "名古屋にいます。"] },
};
