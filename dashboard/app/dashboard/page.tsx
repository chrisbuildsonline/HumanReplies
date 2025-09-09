import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { ReplyChart } from "@/components/dashboard/reply-chart";
import { TopServices } from "@/components/dashboard/top-services";
import { RecentActivity } from "@/components/dashboard/recent-activity";
async function fetchRepliesFromBackend(accessToken: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_HOST}/api/v1/replies/`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store", // Don't cache the response
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch replies from backend:", response.status);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching replies from backend:", error);
    return [];
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  // Get user's session for backend authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Fetch replies from our PostgreSQL backend
  let replies = [];
  if (session?.access_token) {
    replies = await fetchRepliesFromBackend(session.access_token);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={data.user} />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back,{" "}
            {profile?.email
              ? `, ${profile.email.split("@")[0]}`
              : data.user.email?.split("@")[0] || ""}
            !
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your HumanReplies usage and statistics.
          </p>
        </div>

        <div className="grid gap-6">
          <StatsOverview replies={replies || []} />

          <div className="grid lg:grid-cols-2 gap-6">
            <ReplyChart replies={replies || []} />
            <TopServices replies={replies || []} />
          </div>

          <RecentActivity replies={replies || []} />
        </div>
      </main>
    </div>
  );
}
