import { HeroSection } from "../components/hero/hero-section";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs): ReturnType<Route.MetaFunction> {
  return [
    { title: "yantene.net" },
    { name: "description", content: "自己表現・技術実験・発信の場" },
  ];
}

export default function Home(): React.JSX.Element {
  return (
    <div>
      <HeroSection />
    </div>
  );
}
