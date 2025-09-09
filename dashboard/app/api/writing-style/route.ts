import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// This route now persists data via the backend /api/v1/user-settings endpoint
// It wraps the existing user settings infrastructure, serializing the writing style
// into the writing_style text column (JSON string).

function serializeWritingStyle(style: any, customInstructions: string | null) {
  // Store both style analysis result and optional custom instructions
  return JSON.stringify({ style, custom_instructions: customInstructions })
}

function deserializeWritingStyle(raw: string | null | undefined): { style?: any; custom_instructions?: string | null } {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    // Expecting shape { style: ..., custom_instructions: ... }
    if (parsed && typeof parsed === "object" && ("style" in parsed || "custom_instructions" in parsed)) {
      return parsed
    }
    // Fallback: treat entire string as custom instructions text
    return { style: undefined, custom_instructions: raw }
  } catch {
    return { style: undefined, custom_instructions: raw }
  }
}

async function getSessionAndToken() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: "Unauthorized" as const }
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { error: "No session token" as const }
  }
  return { token: session.access_token }
}

export async function GET() {
  try {
    const session = await getSessionAndToken()
    if ('error' in session) {
      return NextResponse.json({ error: session.error }, { status: 401 })
    }

    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/api/v1/user-settings/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!backendResponse.ok) {
      const txt = await backendResponse.text()
      console.error('Failed to fetch user settings (writing-style GET):', txt)
      return NextResponse.json({ error: 'Failed to load writing style' }, { status: 500 })
    }

    const settings = await backendResponse.json()
    const { style, custom_instructions } = deserializeWritingStyle(settings.writing_style)

    return NextResponse.json({
      style: style ?? null,
      custom_instructions: custom_instructions ?? null
    })
  } catch (error) {
    console.error('Writing style GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionAndToken()
    if ('error' in session) {
      return NextResponse.json({ error: session.error }, { status: 401 })
    }

    const { style, custom_instructions } = await request.json()
    if (!style) {
      return NextResponse.json({ error: 'Style data is required' }, { status: 400 })
    }

    const writing_style = serializeWritingStyle(style, custom_instructions || null)

    // Forward to backend user settings update
    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/api/v1/user-settings/`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ writing_style })
    })

    if (!backendResponse.ok) {
      const txt = await backendResponse.text()
      console.error('Failed to update user settings (writing-style PUT):', txt)
      return NextResponse.json({ error: 'Failed to save writing style' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Writing style saved successfully' })
  } catch (error) {
    console.error('Writing style PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}