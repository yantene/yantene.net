import type { ReactNode } from "react";

interface AppLayoutProps {
  readonly children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-base-100">{children}</div>
  );
}
