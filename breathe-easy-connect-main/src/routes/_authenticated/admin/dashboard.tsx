import { createFileRoute } from "@tanstack/react-router";
import { AdminConsole } from "@/components/smartneb/admin-console";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Console — SmartNeb" },
      {
        name: "description",
        content:
          "SmartNeb admin console for user management, device registration, care-team assignment and platform monitoring.",
      },
      { property: "og:title", content: "Admin Console — SmartNeb" },
      {
        property: "og:description",
        content: "Manage users, devices, assignments, alerts and audit logs across SmartNeb.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AdminConsole scope="admin" />,
});
