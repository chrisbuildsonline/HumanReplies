import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// Get tones from our PostgreSQL backend
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Get the authenticated user (optional for tones)
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        let headers: HeadersInit = {
            'Content-Type': 'application/json',
        }

        // Add authorization if user is authenticated
        if (!authError && user) {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }
        }

        // Fetch tones from our PostgreSQL backend
        const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/api/v1/tones/`, {
            method: 'GET',
            headers,
        })

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text()
            console.error("Backend error:", errorText)
            return NextResponse.json({ error: "Failed to fetch tones from backend" }, { status: 500 })
        }

        const tones = await backendResponse.json()
        return NextResponse.json(tones)

    } catch (error) {
        console.error("API error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// Create custom tone in our PostgreSQL backend
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

        // Get user's JWT token for backend authentication
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
            return NextResponse.json({ error: "No session token" }, { status: 401 })
        }

        const requestBody = await request.json()

        // Create custom tone in our PostgreSQL backend
        const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/api/v1/tones/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        })

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text()
            console.error("Backend error:", errorText)
            return NextResponse.json({ error: "Failed to create tone in backend" }, { status: 500 })
        }

        const newTone = await backendResponse.json()
        return NextResponse.json(newTone)

    } catch (error) {
        console.error("API error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
