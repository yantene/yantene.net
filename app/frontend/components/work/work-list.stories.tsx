import { WorkList } from "./work-list";
import { sampleWorks } from "./work-fixture";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof WorkList> = {
  title: "Work/WorkList",
  component: WorkList,
  args: { works: sampleWorks },
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

/** 在り処を書いていない作品だけのとき。名前と概要だけで成り立つ。 */
export const WithoutUrls: Story = {
  args: { works: sampleWorks.map((work) => ({ ...work, url: null })) },
};

/** 1 件だけのとき。下端に何も無い罫線が残らないこと。 */
export const Single: Story = {
  args: { works: sampleWorks.slice(0, 1) },
};

/** 長い概要と長い URL。携帯の幅で横にはみ出さないこと。 */
export const LongText: Story = {
  args: {
    works: [
      {
        slug: "infoholick",
        name: "infoholick",
        summary:
          "読んだものを覚えておくやつ。フィードも Web ページも同じ棚に入れて、後から辿り直せるようにしてある。",
        url: "https://github.com/yantene/infoholick/blob/main/docs/design/very-long-document-name.md",
      },
    ],
  },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
