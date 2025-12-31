import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("/login", "routes/login.tsx"),
  route("/join", "routes/join.tsx"),
] satisfies RouteConfig;






