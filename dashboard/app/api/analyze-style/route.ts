import { type NextRequest, NextResponse } from "next/server"

const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai"

export async function POST(request: NextRequest) {
  try {
    const { posts, customInstructions } = await request.json()

    // Allow analysis with either posts or custom instructions
    if ((!posts || typeof posts !== 'string' || posts.trim().length === 0) && !customInstructions) {
      return NextResponse.json(
        { error: "Either posts text or custom instructions is required" },
        { status: 400 }
      )
    }

    // Check if we have enough content to analyze (only if no custom instructions)
    if (posts && posts.trim().length > 0) {
      const totalContent = posts.trim().length
      if (totalContent < 500 && !customInstructions) {
        return NextResponse.json({
          error: "Insufficient content for analysis",
          message: "Please add more posts to analyze or provide custom instructions. We need at least 500 characters of content to provide accurate style analysis.",
          currentLength: totalContent,
          minimumLength: 500
        }, { status: 400 })
      }
    }

    // Prepare the prompt for style analysis
    let analysisPrompt = `Analyze the writing style and return ONLY a JSON object 
with the following structure (this is an EXAMPLE with dummy values — replace them with your own analysis results):

{
  "formality": 0.6,
  "warmth": 0.7,
  "directness": 0.5,
  "signature_phrases": ["quick thought", "happy to dive in"],
  "banned_terms": ["world-class", "revolutionary"],
  "emoji_usage": "low",
  "sentence_length": "short"
}`;

    if (posts && posts.trim().length > 0) {
      analysisPrompt += `\n\nPosts to analyze:\n${posts.trim()}`;
    }

    if (customInstructions) {
      analysisPrompt += `\n\nCustom Instructions to incorporate:\n${customInstructions}`;

      if (!posts || posts.trim().length === 0) {
        analysisPrompt += `\n\nSince no writing samples were provided, create a writing style profile based on these custom instructions. Use reasonable defaults for the numeric values (0.5 for neutral, adjust as needed based on instructions).`;
      }
    }

    analysisPrompt += `\n\nReturn only the JSON object, no explanation or additional text.`;

    // Call Pollinations API
    const response = await fetch(POLLINATIONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: analysisPrompt
        }],
        model: "openai",
        seed: Math.floor(Math.random() * 1000000), // Random seed for varied responses
        jsonMode: true,
        systemMessage: "You are a writing style analyst. Analyze text and return structured JSON data about writing patterns."
      }),
    })

    if (!response.ok) {
      console.error("Pollinations API error:", response.status, response.statusText)
      return NextResponse.json(
        { error: "Failed to analyze writing style" },
        { status: 500 }
      )
    }

    const result = await response.text()

    try {
      // Parse the outer response structure
      const outerResponse = JSON.parse(result)

      // Extract the actual content from the nested structure
      let actualContent = result
      if (outerResponse.choices && outerResponse.choices[0] && outerResponse.choices[0].message) {
        actualContent = outerResponse.choices[0].message.content
      }

      // Try to parse the actual content as JSON
      const styleAnalysis = typeof actualContent === 'string' ? JSON.parse(actualContent) : actualContent

      // Validate that we got the expected structure
      if (typeof styleAnalysis.formality !== 'number' ||
        typeof styleAnalysis.warmth !== 'number' ||
        typeof styleAnalysis.directness !== 'number') {
        throw new Error("Invalid response structure")
      }

      const totalCharacters = posts ? posts.trim().length : 0

      return NextResponse.json({
        success: true,
        style: styleAnalysis,
        analysis: "Style analysis completed successfully!",
        totalCharacters: totalCharacters
      })

    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError)
      console.error("Raw response:", result)

      // Return a fallback response
      return NextResponse.json({
        success: false,
        error: "Failed to parse style analysis",
        rawResponse: result,
        message: "The AI analysis completed but returned an unexpected format. Please try again."
      }, { status: 500 })
    }

  } catch (error) {
    console.error("Style analysis error:", error)
    return NextResponse.json(
      { error: "Internal server error during style analysis" },
      { status: 500 }
    )
  }
}
