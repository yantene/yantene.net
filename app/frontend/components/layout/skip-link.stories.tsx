import { MainContent } from "./main-content";
import { SkipLink } from "./skip-link";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 焦点が当たるまでは見えない。キャンバスを押してから Tab を 1 回押すと左上に出る。
 * 押すと焦点が下の本文へ移る。
 */
const meta: Meta<typeof SkipLink> = {
  title: "Layout/SkipLink",
  component: SkipLink,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <header className="border-b border-base-300 p-6">
          <a href="#nav" className="link">
            Header link
          </a>
        </header>
        <MainContent className="p-6">
          <p>Main content</p>
          <a href="#body" className="link">
            Link in main
          </a>
        </MainContent>
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
