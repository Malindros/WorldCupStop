import ProfileClient from "@/components/profile/ProfileClient";

interface Props {
  params: { id: string } | Promise<{ id: string }>;
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params;
  const username = decodeURIComponent(id);

  return <ProfileClient username={username} />;
}
