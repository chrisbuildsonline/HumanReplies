"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(({ data: { user } }: any) => {
      setUser(user);
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center space-y-8">
        {/* Logo/Brand */}
        <Link href="/" className="block">
          <span className="text-4xl md:text-5xl font-black text-black">
            HumanReplies
          </span>
        </Link>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {user && (
            <Button
              variant="outline"
              className="chunky-button border-2 border-black text-black hover:bg-black hover:text-white rounded-lg bg-transparent w-full sm:w-auto"
              asChild
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}
          {!user ? (
            <>
              <Button
                variant="outline"
                className="chunky-button border-2 border-black text-black hover:bg-black hover:text-white rounded-lg bg-transparent w-full sm:w-auto"
                asChild
              >
                <Link href="/auth/login">Login</Link>
              </Button>
              <Button
                className="chunky-button bg-orange-500 hover:bg-orange-600 text-white rounded-lg w-full sm:w-auto"
                asChild
              >
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              className="chunky-button border-2 border-black text-black hover:bg-black hover:text-white rounded-lg bg-transparent w-full sm:w-auto"
              onClick={() => {
                const supabase = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                supabase.auth.signOut().then(() => {
                  setUser(null);
                  window.location.href = "/";
                });
              }}
            >
              Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
