import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { env: context.cloudflare.env.APP_ENV };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <p>{loaderData.env}</p>;
}
