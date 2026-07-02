import ThreadDetailClient from "@/components/threads/thread-detail/ThreadDetailClient";

interface Props {
  params: { slug: string } | Promise<{ slug: string }>;
}

export default async function ThreadDetailPage({ params }: Props) {
  const { slug } = await params;

  return <ThreadDetailClient slug={slug} />;
}
