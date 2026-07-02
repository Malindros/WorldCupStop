import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyRefreshToken, verifyToken } from "@/lib/utils/auth";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  const refreshToken = cookieStore.get("refreshToken")?.value;

  const userFromAccess = accessToken ? verifyToken(accessToken) : null;
  const userFromRefresh = userFromAccess ? null : (refreshToken ? verifyRefreshToken(refreshToken) : null);
  const user = userFromAccess || userFromRefresh;

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return children;
}