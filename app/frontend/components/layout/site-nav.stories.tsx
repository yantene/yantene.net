import { SiteNav } from "./site-nav";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SiteNav> = {
  title: "Layout/SiteNav",
  component: SiteNav,
};

export default meta;
type Story = StoryObj<typeof meta>;

/* 帯に並ぶ姿。横一列で、字は控えめに置く。 */
export const InHeader: Story = {
  args: {
    listClassName: "flex items-center gap-6",
    linkClassName:
      "press-control text-sm font-medium text-muted-foreground transition-colors hover:text-primary",
  },
};

/*
 * 現在地の印。
 *
 * `/articles/foo` を見ているときも一覧 (`/articles`) が光ることを確かめる場所。記事を
 * 読んでいる最中に、サイトのどこにいるのかが分からなくなる回帰を見張る。
 *
 * 見ている URL は preview の Router に渡す (.storybook/preview.tsx)。Router は
 * 入れ子にできないので、ここで自前に立て直すことはしない。
 */
export const CurrentArticle: Story = {
  args: InHeader.args,
  parameters: { initialEntries: ["/articles/hacku-2016"] },
};

/* ドロワーに積む姿。指で押すので 1 行の高さを取ってある。 */
export const InDrawer: Story = {
  args: {
    listClassName: "site-menu-list",
    linkClassName: "site-menu-link press-surface",
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};
