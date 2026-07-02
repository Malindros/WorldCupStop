import ModerationQueueClient from "@/components/admin/moderation/ModerationQueueClient";

export default function ModerationQueuePage() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <ModerationQueueClient />
      </div>
    </div>
  );
}
