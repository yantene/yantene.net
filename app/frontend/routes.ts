import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("notes/:noteSlug", "routes/notes.$noteSlug.tsx"),
] satisfies RouteConfig;
