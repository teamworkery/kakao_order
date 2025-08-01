import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/join.tsx"),
  route("/home/:name", "routes/home.$name.tsx"),
  route("/login", "routes/login.tsx"),
  route("/admin", "routes/admin.tsx"),
] satisfies RouteConfig;
