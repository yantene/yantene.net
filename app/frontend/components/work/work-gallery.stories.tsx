import { sampleScreenshots } from "./work-fixture";
import { WorkGallery } from "./work-gallery";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 作品のスクリーンショットの並び。押すと拡大する (記事の画像と同じ器)。
 *
 * 幅は作品のページの本文と同じ 768px (max-w-3xl)。余白は外側に持たせる。
 */
const meta: Meta<typeof WorkGallery> = {
  title: "Work/WorkGallery",
  component: WorkGallery,
  args: { screenshots: sampleScreenshots, label: "スクリーンショット" },
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

/** 横長と縦長が混ざる。高さが揃い、幅だけが変わること。 */
export const Default: Story = {};

/** 1 枚だけ。右に空きが残っても枠が伸びないこと。 */
export const Single: Story = {
  args: { screenshots: sampleScreenshots.slice(0, 1) },
};

/** 縦長だけ。横長が 1 枚も無くても高さが決まること。 */
export const MobileOnly: Story = {
  args: { screenshots: sampleScreenshots.filter((screenshot) => screenshot.kind === "mobile") },
};

/** 寸法を読めなかった画像。width / height が無くても枠は同じ大きさで立つ。 */
export const WithoutDimensions: Story = {
  args: {
    screenshots: sampleScreenshots.map((screenshot) => ({
      ...screenshot,
      width: null,
      height: null,
    })),
  },
};

/** 携帯の幅。はみ出した分は横に送れること (ページは横に伸びない)。 */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
