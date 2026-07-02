"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Calendar,
  Trophy,
  MessageSquare,
  Shield,
  LogIn,
  Moon,
  Sun,
  ChevronDown,
  UserCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Pencil,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { useEffect, useState, startTransition } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const exploreNavItems = [
  { href: "/matches", label: "Match Center", Icon: Calendar },
  { href: "/standings", label: "Standings", Icon: Trophy },
  { href: "/threads", label: "Threads", Icon: MessageSquare },
  { href: "/admin", label: "Admin", Icon: Shield },
] as const;

type ForYouNavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** When set, overrides pathname === href for active styling (e.g. nested routes). */
  isActive?: (pathname: string | null) => boolean;
};

function SidebarNavLink({
  href,
  label,
  Icon,
  showExpandedContent,
  onNavigate,
  isActive,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  showExpandedContent: boolean;
  onNavigate: () => void;
  isActive: boolean;
}) {
  return (
    <Button
      asChild
      variant={isActive ? "default" : "ghost"}
      size="xl"
      className={cn(
        "w-full rounded-full py-2",
        showExpandedContent ? "justify-start px-2" : "justify-center px-2",
        isActive && "font-semibold shadow-lg",
      )}
    >
      <Link
        href={href}
        className={cn("flex items-center", showExpandedContent ? "gap-3" : "justify-center")}
        title={label}
        onClick={onNavigate}
      >
        <span className="flex items-center justify-center rounded-md bg-transparent p-2">
          <Icon
            className={cn(
              "h-6 w-6",
              isActive ? "text-slate-100 dark:text-slate-900" : "text-slate-600 dark:text-slate-100",
            )}
          />
        </span>
        {showExpandedContent && <span>{label}</span>}
      </Link>
    </Button>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const showExpandedContent = isMobileOpen || !isCollapsed;
  /** Narrow rail: horizontal header row overflows; stack so expand control stays visible */
  const isDesktopCollapsed = isCollapsed && !isMobileOpen;

  const profileHref = user ? `/profile/${user.username}` : "/login";

  const forYouNavItems: ForYouNavItem[] =
    isAuthenticated && user
      ? [
          {
            href: profileHref,
            label: "Profile",
            Icon: UserCircle,
            isActive: (p) => p === profileHref,
          },
          {
            href: "/connections/following",
            label: "People",
            Icon: Users,
            isActive: (p) => Boolean(p?.startsWith("/connections")),
          },
        ]
      : [];

  const visibleExplore = exploreNavItems.filter((item) => item.href !== "/admin" || user?.role === "ADMIN");
  const displayName = user?.displayName?.trim() || user?.username || "Guest";

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") {
        document.documentElement.classList.add("dark");
        startTransition(() => setIsDark(true));
      } else if (stored === "light") {
        document.documentElement.classList.remove("dark");
        startTransition(() => setIsDark(false));
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
        startTransition(() => setIsDark(true));
      }

      if (localStorage.getItem("sidebar:collapsed") === "1") {
        startTransition(() => setIsCollapsed(true));
      }
    } catch {
      // ignore (localStorage may be unavailable)
    }
  }, []);

  /** Drawer open + desktop collapsed rail = expanded header in narrow width (clipped). Close overlay when viewport becomes lg+. */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (mq.matches) {
        setIsMobileOpen(false);
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    try {
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/");
    } catch {
      router.push("/logout");
    }
    setIsMobileOpen(false);
  };

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem("sidebar:collapsed", next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  function exploreLinkActive(href: string) {
    if (!pathname) return false;
    if (pathname === href) return true;
    return pathname.startsWith(`${href}/`);
  }

  const navList = (
    <nav aria-label="Main" className="flex flex-col space-y-2 px-1">
      <SidebarNavLink
        href="/"
        label={isAuthenticated ? "Dashboard" : "Home"}
        Icon={isAuthenticated ? LayoutDashboard : Home}
        showExpandedContent={showExpandedContent}
        onNavigate={() => setIsMobileOpen(false)}
        isActive={pathname === "/"}
      />

      {forYouNavItems.length > 0 ? (
        <>
          {showExpandedContent ? (
            <p
              className="px-2 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              id="nav-for-you-heading"
            >
              For you
            </p>
          ) : (
            <div className="mx-auto my-1 h-px w-8 bg-sidebar-border" aria-hidden />
          )}
          <div
            role="group"
            aria-labelledby={showExpandedContent ? "nav-for-you-heading" : undefined}
            className="flex flex-col space-y-2"
          >
            {forYouNavItems.map(({ href, label, Icon, isActive: isActiveFn }) => (
              <SidebarNavLink
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                showExpandedContent={showExpandedContent}
                onNavigate={() => setIsMobileOpen(false)}
                isActive={isActiveFn ? isActiveFn(pathname) : pathname === href}
              />
            ))}
          </div>
          {showExpandedContent ? (
            <p
              className="px-2 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              id="nav-explore-heading"
            >
              Explore
            </p>
          ) : (
            <div className="mx-auto my-1 h-px w-8 bg-sidebar-border" aria-hidden />
          )}
        </>
      ) : null}

      <div
        role="group"
        aria-labelledby={forYouNavItems.length > 0 && showExpandedContent ? "nav-explore-heading" : undefined}
        className="flex flex-col space-y-2"
      >
        {visibleExplore.map(({ href, label, Icon }) => (
          <SidebarNavLink
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            showExpandedContent={showExpandedContent}
            onNavigate={() => setIsMobileOpen(false)}
            isActive={exploreLinkActive(href)}
          />
        ))}
      </div>
    </nav>
  );

  const profileMenu =
    isAuthenticated && user ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex min-w-0 items-center rounded-xl border border-sidebar-border bg-card/50 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              showExpandedContent ? "flex-1 gap-2 px-2 py-1.5" : "w-full justify-center px-2 py-2 lg:w-full",
            )}
            aria-label="Open user menu"
            title={displayName}
          >
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-sidebar-border bg-muted">
              {user.avatar?.url ? (
                <Image src={user.avatar.url} alt={displayName} width={36} height={36} className="h-full w-full object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {showExpandedContent && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={profileHref} className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile/edit" className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              <span>Edit profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/connections/following" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>People</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              void handleLogout();
            }}
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      <Button asChild variant="default" size="lg" className={showExpandedContent ? "flex-1" : "w-full"}>
        <Link
          href="/login"
          className={cn("flex w-full items-center justify-center px-4 py-2", showExpandedContent && "gap-2")}
          onClick={() => setIsMobileOpen(false)}
        >
          <LogIn className="h-4 w-4" />
          {showExpandedContent && <span>Login</span>}
        </Link>
      </Button>
    );

  return (
    <>
      <div
        className={cn(
          "fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-sidebar-border bg-sidebar/90 px-3 backdrop-blur-md lg:hidden",
          "text-sidebar-foreground",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={() => setIsMobileOpen((open) => !open)}
          aria-label={isMobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileOpen}
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-sidebar-border bg-card shadow-sm">
          <Image src="/logo.png" alt="" width={36} height={36} className="size-9 object-contain p-1" priority />
        </div>
        <p className="min-w-0 flex-1 text-sm font-semibold leading-tight">SportsDeck</p>
      </div>

      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 border-0 bg-black/35 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close menu backdrop"
        />
      )}

      <aside
        className={cn(
          "flex flex-col justify-between overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground transition-[transform,width,min-width] duration-200 ease-in-out",
          /* Full height on desktop; on mobile sit below the fixed top bar so logo/title are not hidden under z-50 */
          "h-dvh max-lg:top-14 max-lg:h-[calc(100dvh-3.5rem)] lg:top-0",
          /* Mobile drawer: narrow strip for nav labels; desktop: full rail width */
          "fixed left-0 z-[45] w-[min(100vw,13rem)] max-lg:-translate-x-full max-lg:shadow-lg sm:max-lg:w-[min(100vw,14.5rem)]",
          isMobileOpen && "max-lg:translate-x-0",
          "lg:relative lg:z-auto lg:translate-x-0 lg:shadow-none",
          isCollapsed ? "lg:w-[5.25rem] lg:min-w-[5.25rem] lg:shrink-0" : "lg:w-64 lg:min-w-[16rem] lg:shrink-0",
        )}
      >
        <div>
          {isDesktopCollapsed ? (
            <div className="mb-5 flex w-full flex-col items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={toggleCollapsed}
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-sidebar-border bg-card shadow-sm">
                <Image
                  src="/logo.png"
                  alt="SportsDeck logo"
                  width={48}
                  height={48}
                  className="size-12 object-contain p-1.5"
                  priority
                />
              </div>
            </div>
          ) : (
            <>
              {/* Desktop: logo + title + collapse (brand lives in mobile top bar only) */}
              <div className="mb-5 hidden w-full min-w-0 items-center gap-3 lg:flex">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-sidebar-border bg-card shadow-sm">
                  <Image
                    src="/logo.png"
                    alt="SportsDeck logo"
                    width={48}
                    height={48}
                    className="size-12 object-contain p-1.5"
                    priority
                  />
                </div>
                {showExpandedContent ? (
                  <h2 className="flex-1 whitespace-nowrap text-2xl font-bold leading-none tracking-tight text-sidebar-foreground">
                    SportsDeck
                  </h2>
                ) : (
                  <span className="min-w-0 flex-1" aria-hidden="true" />
                )}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleCollapsed}
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="mx-2 my-3 h-px w-full rounded-sm bg-sidebar-border" aria-hidden="true" />
          {navList}
        </div>

        <div className="border-t border-sidebar-border pt-3">
          <div className={cn("flex items-center", showExpandedContent ? "gap-1" : "flex-col gap-2")}>
            {profileMenu}
            <Button variant="outline" size="icon-lg" onClick={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} className="ml-0">
              {isDark ? <Sun className="h-4 w-4 text-slate-200" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
