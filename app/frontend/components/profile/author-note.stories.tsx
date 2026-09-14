import { AuthorNote } from "./author-note";
import { sampleProfile } from "./profile-fixture";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof AuthorNote> = {
  title: "Profile/AuthorNote",
  component: AuthorNote,
  args: { profile: sampleProfile, origin: "https://yantene.net" },
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

/**
 * プロフィールがまだ同期されていないとき。
 *
 * 画面には何も出ないが、`p-author h-card` の印は sr-only で残る。消すと Webmention の
 * 著者発見が黙って壊れる。
 */
export const WithoutProfile: Story = {
  args: { profile: null },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
