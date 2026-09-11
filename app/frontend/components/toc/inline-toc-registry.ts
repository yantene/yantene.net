import { createContext } from "react";

/**
 * 差し込み目次が自分の要素を預ける口。
 *
 * 節名バーは「目次を通り過ぎたら出る」という作りなので、目次の要素を見つける必要がある。
 * class 名で DOM から探すこともできるが、それだと見た目のために付けた名前が別の
 * コンポーネントの動作を握ることになり、改名したときに何も言わず壊れる。
 *
 * 預け先を持つのはページ (routes/articles.$slug.tsx)。目次とバーの両方を描く唯一の場所で、
 * そこから片方へは文脈で、もう片方へは props で渡る。目次は本文の中 (MdastRenderer が
 * 差し込む) に居るので、降ろす側は文脈でしか届かない。
 *
 * 既定は何もしない関数。目次を描く場所がページの外 (Storybook やテスト) でも壊れない。
 */
export const InlineTocRegistry = createContext<(element: HTMLElement | null) => void>(() => {});
