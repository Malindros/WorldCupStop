import AdminDashboardCards from "@/components/admin/AdminDashboardCards";

export default function AdminPage() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Access moderation tools and user management controls.
          </p>
        </div>

        <AdminDashboardCards />
      </div>
    </div>
  );
}
