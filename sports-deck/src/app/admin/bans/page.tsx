import BanAppealsQueueClient from "@/components/admin/bans/BanAppealsQueueClient";

export default function AdminBansPage() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <BanAppealsQueueClient />
      </div>
    </div>
  );
}
