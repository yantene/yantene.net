import { WorkFacts } from "./work-facts";
import type { Meta, StoryObj } from "@storybook/react-vite";

/* 作品の諸元。どの欄も省略できるので、欠けた姿を 1 つずつ確かめる。 */
const meta: Meta<typeof WorkFacts> = {
  title: "Work/WorkFacts",
  component: WorkFacts,
  args: {
    work: {
      stack: ["TypeScript", "Cloudflare Workers", "Hono"],
      period: { from: "2024", until: "2025" },
      role: "設計から運用まで 1 人で担当",
    },
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

/** 終わりを書いていない時期。始まりだけが出る。 */
export const OpenPeriod: Story = {
  args: { work: { stack: [], period: { from: "2024-06", until: null }, role: null } },
};

/** 技術だけ。ほかの行が出ないこと。 */
export const StackOnly: Story = {
  args: { work: { stack: ["Ruby", "Sorbet"], period: null, role: null } },
};

/** 札が多いとき。折り返して、名前の柱が動かないこと。 */
export const ManyTags: Story = {
  args: {
    work: {
      stack: [
        "TypeScript",
        "Cloudflare Workers",
        "Hono",
        "React Router",
        "Drizzle ORM",
        "D1",
        "R2",
        "Workers AI",
        "Tailwind CSS",
      ],
      period: { from: "2024-06-04", until: "2024-06-18" },
      role: "設計から運用まで 1 人で担当",
    },
  },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

/** 何も書いていない作品。何も描かれないこと。 */
export const Empty: Story = {
  args: { work: { stack: [], period: null, role: null } },
};
