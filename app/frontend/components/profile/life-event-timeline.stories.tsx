import { LifeEventTimeline } from "./life-event-timeline";
import { sampleLifeEvents } from "./profile-fixture";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof LifeEventTimeline> = {
  title: "Profile/LifeEventTimeline",
  component: LifeEventTimeline,
  args: { events: sampleLifeEvents },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl px-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 3 つの粒度 (日・月・年) が並ぶ姿。埋めた桁は出さない。 */
export const Default: Story = {};

/** 出来事が 1 つだけのとき。線を引く相手がいないので縦線は出ない。 */
export const SingleEvent: Story = {
  args: { events: sampleLifeEvents.slice(0, 1) },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
