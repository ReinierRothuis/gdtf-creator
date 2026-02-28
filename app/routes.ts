import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("session/:id", "routes/session.tsx"),
  route("storybook", "routes/storybook.tsx"),
] satisfies RouteConfig;
