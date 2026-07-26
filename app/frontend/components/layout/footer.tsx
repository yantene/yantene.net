// フッター帯も Celestim と同じ空のサイクルで塗る。keyframes の定義元なので、
// ヒーローの無いページでもアニメが効くよう明示的に読み込む。
import "~/frontend/components/hero/celestim.css";

const currentYear = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="relative border-t border-border/50 [animation:sky-color-cycle_288s_linear_infinite]">
      {/*
        白の重ねは時間帯で濃さを変える (夜は空が暗く、一定濃度だと文字が読めなくなる)。
        濃さの根拠は celestim.css の celestim-veil-cycle を参照。
      */}
      <div className="relative backdrop-blur-sm [animation:celestim-veil-cycle_288s_linear_infinite]">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-8">
          <p className="text-xs text-foreground/80">
            &copy; {currentYear} yantene.net
          </p>
        </div>
      </div>
    </footer>
  );
}
