"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "access_denied":
        return "Access was denied. Please try again."
      case "server_error":
        return "A server error occurred. Please try again later."
      case "temporarily_unavailable":
        return "The service is temporarily unavailable. Please try again later."
      default:
        return errorDescription || "An authentication error occurred. Please try again."
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-foreground">HumanReplies</h1>
          </Link>
        </div>

        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl">Authentication Error</CardTitle>
            <CardDescription>There was a problem with your authentication</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              {getErrorMessage(error)}
            </div>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/auth/login">Try Signing In Again</Link>
              </Button>
              <Button variant="outline" asChild className="w-full bg-transparent">
                <Link href="/">Return to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
