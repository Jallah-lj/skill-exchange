"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  ChevronsUpDown,
  Home,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  UserCircle,
  Calendar,
  Compass,
  BadgeCheck,
  Building2,
  FileText,
  Headphones,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationsPanel } from "@/components/notifications-panel";
import { LogoMark } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const sidebarVariants = {
  open: { width: "15rem" },
  closed: { width: "3.05rem" },
};

const contentVariants = {
  open: { display: "block", opacity: 1 },
  closed: { display: "block", opacity: 1 },
};

const labelVariants = {
  open: { x: 0, opacity: 1, transition: { x: { stiffness: 1000, velocity: -100 } } },
  closed: { x: -20, opacity: 0, transition: { x: { stiffness: 100 } } },
};

const transitionProps = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
} as const;

const staggerVariants = {
  open: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
  closed: {},
};

const navLinks = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/matches", label: "Matches", icon: MessageSquare },
  { href: "/sessions", label: "Sessions", icon: Calendar },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .is("read_at", null);
      setUnreadCount(count ?? 0);
      setLoading(false);
    };
    load();
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Network error — session is cleared locally regardless
    }
    router.push("/")
    router.refresh()
  };

  return (
    <motion.div
      className="fixed left-0 top-0 z-40 h-full shrink-0 border-r"
      initial="closed"
      animate={isCollapsed ? "closed" : "open"}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <motion.div
        className="relative z-40 flex h-full shrink-0 flex-col bg-background text-muted-foreground transition-all"
        variants={contentVariants}
      >
        <motion.ul variants={staggerVariants} className="flex h-full flex-col">
          <div className="flex grow flex-col items-center">

            {/* Logo header */}
            <Link href="/browse" className="flex h-[54px] w-full shrink-0 items-center border-b px-3 gap-2 hover:bg-muted transition-colors">
              <LogoMark className="h-6 shrink-0" />
              <motion.li variants={labelVariants}>
                {!isCollapsed && (
                  <span className="text-xl font-bold text-foreground">SkillSwap</span>
                )}
              </motion.li>
            </Link>

            {/* Nav links */}
            <div className="flex h-full w-full flex-col">
              <div className="flex grow flex-col gap-4">
                <ScrollArea className="h-16 grow p-2">
                  <div className="flex w-full flex-col gap-1">
                    {navLinks.map(({ href, label, icon: Icon }) => {
                      const isActive = pathname?.startsWith(href);
                      const badge = href === "/matches" ? unreadCount : 0;
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                            isActive && "bg-muted text-violet-600 dark:text-violet-400",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <motion.li variants={labelVariants}>
                            {!isCollapsed && (
                              <div className="ml-2 flex items-center gap-2">
                                <p className="text-sm font-medium">{label}</p>
                                {badge > 0 && (
                                  <Badge className="h-fit w-fit rounded border-none bg-violet-100 px-1.5 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" variant="outline">
                                    {badge > 9 ? "9+" : badge}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </motion.li>
                        </Link>
                      );
                    })}

                    <Link
                      href="/orgs"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.startsWith("/orgs") && "bg-muted text-violet-600 dark:text-violet-400",
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <motion.li variants={labelVariants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Organizations</p>}
                      </motion.li>
                    </Link>

                    <Link
                      href="/resources"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.startsWith("/resources") && "bg-muted text-violet-600 dark:text-violet-400",
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <motion.li variants={labelVariants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Resources</p>}
                      </motion.li>
                    </Link>

                    {profile && (
                      <div className="flex w-full flex-row items-center rounded-md py-1 transition hover:bg-muted hover:text-primary">
                        <NotificationsPanel userId={profile.id} side="right" align="start" />
                        <motion.li variants={labelVariants}>
                          {!isCollapsed && <p className="ml-1 text-sm font-medium">Notifications</p>}
                        </motion.li>
                      </div>
                    )}

                    <Separator className="my-1" />

                    <Link
                      href="/profile"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.startsWith("/profile") && "bg-muted text-violet-600 dark:text-violet-400",
                      )}
                    >
                      <UserCircle className="h-4 w-4 shrink-0" />
                      <motion.li variants={labelVariants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Profile</p>}
                      </motion.li>
                    </Link>

                    {profile && profile.kyc_status !== "verified" && (
                      <Link
                        href="/verify"
                        className={cn(
                          "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition",
                          pathname?.startsWith("/verify")
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                            : "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20",
                        )}
                      >
                        <BadgeCheck className="h-4 w-4 shrink-0" />
                        <motion.li variants={labelVariants}>
                          {!isCollapsed && (
                            <div className="ml-2 flex items-center gap-2">
                              <p className="text-sm font-medium">Get Verified</p>
                              {profile.kyc_status === "pending" && (
                                <Badge className="h-fit w-fit rounded border-none bg-yellow-100 px-1.5 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px]" variant="outline">
                                  Pending
                                </Badge>
                              )}
                            </div>
                          )}
                        </motion.li>
                      </Link>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Bottom: support + settings + user */}
              <div className="flex flex-col p-2 gap-1">
                <Link
                  href="/support"
                  className={cn(
                    "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                    pathname?.startsWith("/support") && "bg-muted text-violet-600 dark:text-violet-400",
                  )}
                >
                  <Headphones className="h-4 w-4 shrink-0" />
                  <motion.li variants={labelVariants}>
                    {!isCollapsed && <p className="ml-2 text-sm font-medium">Support</p>}
                  </motion.li>
                </Link>

                <Link
                  href="/settings"
                  className={cn(
                    "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                    pathname?.startsWith("/settings") && "bg-muted text-violet-600 dark:text-violet-400",
                  )}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <motion.li variants={labelVariants}>
                    {!isCollapsed && <p className="ml-2 text-sm font-medium">Settings</p>}
                  </motion.li>
                </Link>

                {/* User dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full rounded-md hover:bg-muted transition-colors">
                    <div className="flex h-8 w-full flex-row items-center gap-2 px-2 py-1.5">
                      {loading ? (
                        <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                      ) : (
                        <Avatar className="h-4 w-4 shrink-0">
                          <AvatarImage src={profile?.avatar_url ?? ""} />
                          <AvatarFallback className="text-[8px]">
                            {profile?.name?.slice(0, 2).toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <motion.li variants={labelVariants} className="flex w-full items-center gap-2 overflow-hidden">
                        {!isCollapsed && (
                          <>
                            {loading ? (
                              <Skeleton className="h-3 w-20 rounded" />
                            ) : (
                              <p className="text-sm font-medium truncate">{profile?.name ?? "Account"}</p>
                            )}
                            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50" />
                          </>
                        )}
                      </motion.li>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent sideOffset={8} align="start" className="w-52">
                    <div className="flex flex-row items-center gap-2 p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url ?? ""} />
                        <AvatarFallback>{profile?.name?.slice(0, 2).toUpperCase() ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-left overflow-hidden">
                        <span className="text-sm font-medium truncate">{profile?.name ?? "—"}</span>
                        <span className="text-xs text-muted-foreground truncate">{profile?.location ?? "SkillSwap"}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem nativeButton={false} render={<Link href="/profile" />} className="flex items-center gap-2 cursor-pointer">
                      <UserCircle className="h-4 w-4" /> My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem nativeButton={false} render={<Link href="/settings" />} className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 cursor-pointer text-destructive">
                      <LogOut className="h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </motion.ul>
      </motion.div>
    </motion.div>
  );
}
