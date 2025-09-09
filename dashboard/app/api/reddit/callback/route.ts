import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const returnedState = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const popupMode = request.cookies.get('reddit_oauth_mode')?.value === 'popup'

    if (error) {
        if (popupMode) {
            return htmlPostMessage('error', { error })
        }
        return NextResponse.redirect(`${appUrl}/settings?reddit_error=${encodeURIComponent(error)}`)
    }
    if (!code) {
        if (popupMode) {
            return htmlPostMessage('error', { error: 'no_code' })
        }
        return NextResponse.redirect(`${appUrl}/settings?reddit_error=no_code`)
    }

    // Validate state to mitigate CSRF
    const storedState = request.cookies.get('reddit_oauth_state')?.value
    if (!storedState || storedState !== returnedState) {
        if (popupMode) {
            return htmlPostMessage('error', { error: 'state_mismatch' })
        }
        return NextResponse.redirect(`${appUrl}/settings?reddit_error=state_mismatch`)
    }

    const clientId = process.env.REDDIT_CLIENT_ID
    const clientSecret = process.env.REDDIT_CLIENT_SECRET
    const redirectUri = `${appUrl}/api/reddit/callback`

    if (!clientId || !clientSecret) {
        if (popupMode) {
            return htmlPostMessage('error', { error: 'missing_client_config' })
        }
        return NextResponse.redirect(`${appUrl}/settings?reddit_error=missing_client_config`)
    }

    try {
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const form = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        })

        const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'HumanReplies/1.0 (by u/YourRedditUsername)'
            },
            body: form,
        })

        const rawTokenText = await tokenResponse.text()
        if (!tokenResponse.ok) {
            console.error('Reddit token failure status', tokenResponse.status, rawTokenText)
            if (popupMode) {
                return htmlPostMessage('error', { error: `token_${tokenResponse.status}` })
            }
            return NextResponse.redirect(`${appUrl}/settings?reddit_error=token_${tokenResponse.status}`)
        }

        let tokens: any
        try {
            tokens = JSON.parse(rawTokenText)
        } catch (e) {
            console.error('Failed parsing token JSON', rawTokenText)
            return NextResponse.redirect(`${appUrl}/settings?reddit_error=token_parse`)
        }

        if (!tokens.access_token) {
            if (popupMode) {
                return htmlPostMessage('error', { error: 'no_access_token' })
            }
            return NextResponse.redirect(`${appUrl}/settings?reddit_error=no_access_token`)
        }

        // First try /user/me to get the username explicitly
        const meResp = await fetch('https://oauth.reddit.com/api/v1/me', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'User-Agent': 'HumanReplies/1.0 (by u/YourRedditUsername)'
            }
        })
        let username: string | null = null
        if (meResp.ok) {
            try {
                const meJson = await meResp.json()
                username = meJson?.name || null
            } catch { }
        }

        const basePostsUrl = username
            ? `https://oauth.reddit.com/user/${encodeURIComponent(username)}/submitted?limit=50`
            : 'https://oauth.reddit.com/user/me/submitted?limit=50'

        let postsResp = await fetch(basePostsUrl, {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'User-Agent': 'HumanReplies/1.0 (by u/YourRedditUsername)'
            }
        })

        // If 400 and we used /user/me/, try again with explicit username if we have it
        if (!postsResp.ok && postsResp.status === 400 && !username) {
            // attempt second strategy: fetch username then retry
            const secondMe = await fetch('https://oauth.reddit.com/api/v1/me', {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                    'User-Agent': 'HumanReplies/1.0 (by u/YourRedditUsername)'
                }
            })
            if (secondMe.ok) {
                try {
                    const j = await secondMe.json()
                    if (j?.name) {
                        const retryUrl = `https://oauth.reddit.com/user/${encodeURIComponent(j.name)}/submitted?limit=50`
                        postsResp = await fetch(retryUrl, {
                            headers: {
                                Authorization: `Bearer ${tokens.access_token}`,
                                'User-Agent': 'HumanReplies/1.0 (by u/YourRedditUsername)'
                            }
                        })
                    }
                } catch { }
            }
        }

        const rawPostsText = await postsResp.text()
        if (!postsResp.ok) {
            console.error('Reddit posts failure', postsResp.status, rawPostsText, 'URL tried:', basePostsUrl)
        }

        // Fetch comments as well (primary source of writing style usually)
        let commentsResp: Response | null = null
        let rawCommentsText = ''
        try {
            const commentsUrl = username
                ? `https://oauth.reddit.com/user/${encodeURIComponent(username)}/comments?limit=100`
                : 'https://oauth.reddit.com/user/me/comments?limit=100'
            commentsResp = await fetch(commentsUrl, {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                    'User-Agent': 'HumanReplies/1.0 (by u/YourRedditUsername)'
                }
            })
            rawCommentsText = await commentsResp.text()
            if (!commentsResp.ok) {
                console.error('Reddit comments failure', commentsResp.status, rawCommentsText)
            }
        } catch (e) {
            console.error('Reddit comments fetch exception', e)
        }

        let postsJson: any
        try {
            postsJson = rawPostsText ? JSON.parse(rawPostsText) : { data: { children: [] } }
        } catch (e) {
            console.error('Failed parsing posts JSON', rawPostsText)
            postsJson = { data: { children: [] } }
        }

        let commentsJson: any = { data: { children: [] } }
        if (rawCommentsText) {
            try {
                commentsJson = JSON.parse(rawCommentsText)
            } catch (e) {
                console.error('Failed parsing comments JSON', rawCommentsText)
            }
        }

        // User requested: Do not filter out ANYTHING.
        // We will:
        //  - Include every submission selftext (or title if selftext empty)
        //  - Include every comment body (including [deleted]/[removed])
        //  - Preserve URLs & original whitespace except leading/trailing trim per block
        // Warning: Very large total size may exceed URL length limits; if so we return truncation error.

        const submissionTexts: string[] = (postsJson?.data?.children || []).map((c: any) => {
            const d = c?.data || {}
            const txt = (d.selftext && d.selftext.length > 0) ? d.selftext : (d.title || '')
            return typeof txt === 'string' ? txt.trim() : ''
        }).filter((t: string) => t)

        const commentTexts: string[] = (commentsJson?.data?.children || []).map((c: any) => {
            const d = c?.data || {}
            const body = d.body || ''
            return typeof body === 'string' ? body.trim() : ''
        }).filter((t: string) => t)

        const combinedList = [...commentTexts, ...submissionTexts]

        if (!combinedList.length) {
            if (popupMode) {
                return htmlPostMessage('error', { error: 'no_text_content' })
            }
            return NextResponse.redirect(`${appUrl}/settings?reddit_error=no_text_content`)
        }

        const combined = combinedList.join('\n\n')

        // Protect against very large query string (rough heuristic ~6000 chars encoded)
        const encoded = encodeURIComponent(combined)
        if (encoded.length > 6000) {
            if (popupMode) {
                return htmlPostMessage('error', { error: 'too_large', count: combinedList.length })
            }
            return NextResponse.redirect(`${appUrl}/settings?reddit_error=too_large&reddit_count=${combinedList.length}`)
        }
        const count = combinedList.length

        // Clear state cookie after successful use
        if (popupMode) {
            return htmlPostMessage('success', { posts: combined, count })
        }
        const redirect = NextResponse.redirect(`${appUrl}/settings?reddit_posts=${encoded}&reddit_count=${count}`)
        redirect.cookies.set('reddit_oauth_state', '', { maxAge: 0, path: '/' })
        return redirect
    } catch (e) {
        console.error('Reddit OAuth unexpected error', e)
        if (popupMode) {
            return htmlPostMessage('error', { error: 'exception' })
        }
        return NextResponse.redirect(`${appUrl}/settings?reddit_error=exception`)
    }
}

function htmlPostMessage(status: 'success' | 'error', payload: any) {
    const safe = JSON.stringify({ status, ...payload })
    const html = `<!DOCTYPE html><html><body><script>
    (function(){
      const data = ${safe};
      // Post to opener if exists, then close.
      if (window.opener) {
        window.opener.postMessage({ source: 'reddit-oauth', data }, '*');
        window.close();
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'reddit-oauth', data }, '*');
      } else {
        document.body.innerText = 'Completed. You can close this window.';
      }
    })();
  </script></body></html>`
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
}
