import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("/:name", "routes/$name.tsx"),
  route("/join", "routes/join.tsx"),
  route("/login", "routes/login.tsx"),
  route("/admin", "routes/admin.tsx"),
  route("/owner/orders", "routes/owner.orders.tsx"),
  route("/auth/callback", "routes/auth/callback.tsx"),
] satisfies RouteConfig;
