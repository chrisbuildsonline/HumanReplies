import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// Get replies from our PostgreSQL backend
export async function GET(request: NextRequest) {
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

    // Get user's JWT token for backend authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return NextResponse.json({ error: "No session token" }, { status: 401 })
    }

    // Fetch replies from our PostgreSQL backend
    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/api/v1/replies/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!backendResponse.ok) {
      console.error("Backend error:", await backendResponse.text())
      return NextResponse.json({ error: "Failed to fetch replies from backend" }, { status: 500 })
    }

    const replies = await backendResponse.json()
    return NextResponse.json(replies)

  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

