import { createFileRoute } from "@tanstack/react-router";
import { AdminConsole } from "@/components/smartneb/admin-console";

export const Route = createFileRoute("/_authenticated/super-admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Platform Console — SmartNeb" },
      {
        name: "description",
        content:
          "SmartNeb platform console for system health, telemetry oversight, device fleet and audit logs.",
      },
      { property: "og:title", content: "Platform Console — SmartNeb" },
      {
        property: "og:description",
        content: "Full-platform oversight of users, devices, telemetry, alerts and audit history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AdminConsole scope="super_admin" />,
});
