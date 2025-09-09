import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

interface RouteParams {
    params: {
        id: string
    }
}

// Update custom tone in our PostgreSQL backend
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

        // Update custom tone in our PostgreSQL backend
        const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/api/v1/tones/${params.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        })

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text()
            console.error("Backend error:", errorText)
            return NextResponse.json({ error: "Failed to update tone in backend" }, { status: 500 })
        }

        const updatedTone = await backendResponse.json()
        return NextResponse.json(updatedTone)

    } catch (error) {
        console.error("API error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// Delete custom tone from our PostgreSQL backend
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

        // Delete custom tone from our PostgreSQL backend
        const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/api/v1/tones/${params.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
        })

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text()
            console.error("Backend error:", errorText)
            return NextResponse.json({ error: "Failed to delete tone in backend" }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("API error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
