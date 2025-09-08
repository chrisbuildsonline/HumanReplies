import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { posts } = await request.json()

    if (!posts || typeof posts !== "string") {
      return NextResponse.json({ error: "Posts content is required" }, { status: 400 })
    }

    // Simple style analysis based on text patterns
    const analysis = analyzeWritingStyle(posts)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("Error analyzing writing style:", error)
    return NextResponse.json({ error: "Failed to analyze writing style" }, { status: 500 })
  }
}

function analyzeWritingStyle(text: string): string {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
  const avgSentenceLength = words.length / sentences.length

  let style = "Based on your writing samples, your style is "

  // Analyze sentence length
  if (avgSentenceLength < 8) {
    style += "concise and punchy. You prefer short, direct sentences that get straight to the point. "
  } else if (avgSentenceLength > 15) {
    style += "detailed and elaborate. You tend to use longer, more complex sentences with rich descriptions. "
  } else {
    style += "balanced and conversational. You use a good mix of short and medium-length sentences. "
  }

  // Check for questions
  const questionCount = (text.match(/\?/g) || []).length
  if (questionCount > 0) {
    style += "You often engage readers with questions, making your writing interactive and thought-provoking. "
  }

  // Check for exclamations
  const exclamationCount = (text.match(/!/g) || []).length
  if (exclamationCount > 0) {
    style += "Your writing has energy and enthusiasm, using exclamations to emphasize key points. "
  }

  // Check for common casual words
  const casualWords = ["really", "pretty", "quite", "just", "actually", "basically"]
  const casualCount = casualWords.filter((word) => text.toLowerCase().includes(word)).length

  if (casualCount > 2) {
    style += "Your tone is casual and approachable, using everyday language that feels natural and friendly."
  } else {
    style += "Your tone is more formal and polished, with careful word choice and structured expression."
  }

  return style
}
