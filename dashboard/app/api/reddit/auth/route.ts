import { NextResponse } from "next/server"

// Build the Reddit authorize URL in a safer, more explicit way
function buildAuthorizeUrl(params: Record<string, string>) {
    const usp = new URLSearchParams(params)
    return `https://www.reddit.com/api/v1/authorize?${usp.toString()}`
}

export async function GET(request: Request) {
    const reqUrl = new URL(request.url)
    const popup = reqUrl.searchParams.get('popup') === '1'
    const clientId = process.env.REDDIT_CLIENT_ID
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${appUrl}/api/reddit/callback`
    const scope = 'identity history'
    const state = crypto.randomUUID()

    if (!clientId) {
        return NextResponse.json(
            { error: 'Reddit client ID not configured' },
            { status: 500 }
        )
    }

    // IMPORTANT: redirect URI must EXACTLY match what you registered in Reddit app settings
    // Visit https://www.reddit.com/prefs/apps and ensure this exact redirectUri is listed.

    const authorizeUrl = buildAuthorizeUrl({
        client_id: clientId,
        response_type: 'code',
        state,
        redirect_uri: redirectUri,
        duration: 'temporary', // or 'permanent' if you want refresh tokens
        scope,
    })

    // Debug logging (visible in server console) to verify exact redirect URI & built URL
    // Remove once working.
    console.log('[Reddit OAuth] Using redirectUri:', redirectUri)
    console.log('[Reddit OAuth] Authorize URL:', authorizeUrl)

    const res = NextResponse.redirect(authorizeUrl)
    // Store state in an HttpOnly cookie for CSRF protection
    res.cookies.set('reddit_oauth_state', state, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 300, // 5 minutes
    })
    if (popup) {
        res.cookies.set('reddit_oauth_mode', 'popup', {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 300,
        })
    }
    return res
}
