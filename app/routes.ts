import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("/join", "routes/join.tsx"),
  route("/login", "routes/login.tsx"),
  route("/forgot-password", "routes/forgot-password.tsx"),
  route("/reset-password", "routes/reset-password.tsx"),
  route("/admin", "routes/admin.tsx"),
  route("/owner/orders", "routes/owner.orders.tsx"),
  route("/auth/callback", "routes/auth/callback.tsx"),
  // Customer routes
  route("/customer/orders", "routes/customer/orders.tsx"),
  route("/customer/order-success", "routes/customer/order-success.tsx"),
  route("/customer/phone", "routes/customer/phone.tsx"),
  route("/customer/delete-account", "routes/customer/delete-account.tsx"),
  // Legal pages
  route("/privacy", "routes/privacy.tsx"),
  route("/terms", "routes/terms.tsx"),
  // Dynamic store route (must be last to avoid catching other routes)
  route("/:name", "routes/$name.tsx"),
] satisfies RouteConfig;
