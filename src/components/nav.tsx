"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GradientText } from "@/components/magicui/gradient-text";
import { Button, buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/bet", label: "Bet" },
  { href: "/leaderboard", label: "Lestvica" },
  { href: "/stats", label: "Stats" },
  { href: "/analytics", label: "Analytics" },
  { href: "/awards", label: "Awards" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4">
        <Link href="/" className="mr-2 flex items-center gap-2 font-extrabold">
          <span className="text-xl">⚽</span>
          <GradientText className="hidden text-base sm:inline">
            Mundial &rsquo;26
          </GradientText>
        </Link>

        <nav className="no-scrollbar flex items-center gap-0.5 overflow-x-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-muted-foreground",
                pathname === l.href && "bg-accent text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isPending ? null : session?.user ? (
            <>
              <UserAvatar
                name={session.user.name}
                image={session.user.image}
                className="size-7"
              />
              <Button
                variant="ghost"
                size="icon"
                title="Sign out"
                onClick={() => signOut()}
              >
                <LogOut />
              </Button>
            </>
          ) : (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
