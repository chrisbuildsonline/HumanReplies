import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { service } = await request.json()

    if (!service || !["X", "LinkedIn", "Facebook"].includes(service)) {
      return NextResponse.json({ error: "Invalid service" }, { status: 400 })
    }

    // Insert the reply record
    const { data, error } = await supabase
      .from("replies")
      .insert({
        user_id: user.id,
        service,
        reply_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to record reply" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
