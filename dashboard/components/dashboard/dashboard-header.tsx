"use client";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface DashboardHeaderProps {
  user: User;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 flex h-16 items-center justify-between">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-foreground">
            HumanReplies
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-8">
          <Link
            href="/dashboard"
            className={`text-sm font-black text-foreground hover:text-orange-600 transition-colors px-3 py-2 rounded-lg hover:bg-orange-50 ${
              pathname === "/dashboard" ? "border-2 border-black" : ""
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className={`text-sm font-black text-foreground hover:text-orange-600 transition-colors px-3 py-2 rounded-lg hover:bg-orange-50 ${
              pathname === "/settings" ? "border-2 border-black" : ""
            }`}
          >
            Settings
          </Link>
          <Link
            href="/"
            className="text-sm font-black text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            Home
          </Link>
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-sm">{user.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/dashboard">Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/">Home</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive"
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
