import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserFromRequest, type AuthUser } from "@/lib/utils/auth";
import type { Role } from "../../prisma/generated/client";

type MaybePromise<T> = T | Promise<T>;
type AuthRouteHandler<TContext = any> = (request: NextRequest, user: AuthUser, context: TContext) => MaybePromise<Response>;
type AuthOptions = { role?: Role };

/**
 * Wrap a Next.js route handler with authentication and optional role check.
 * handler: async (request, user, ...rest)
 * options: { role: 'USER' | 'ADMIN' }
 */
export function withAuth<TContext = any>(handler: AuthRouteHandler<TContext>, options: AuthOptions = {}) {
  const { role } = options;

  return async (request: NextRequest, context?: TContext): Promise<Response> => {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow if user's role matches required role,
    // or if required role is USER and user is ADMIN (admin is a superset).
    if (role && !(user.role === role || (role === "USER" && user.role === "ADMIN"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(request, user, context as TContext);
  };
}

export function requireUser<TContext = any>(handler: AuthRouteHandler<TContext>) {
  return withAuth(handler, { role: "USER" });
}

export function requireAdmin<TContext = any>(handler: AuthRouteHandler<TContext>) {
  return withAuth(handler, { role: "ADMIN" });
}
