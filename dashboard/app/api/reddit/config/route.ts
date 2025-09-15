import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  
  const configured = !!(clientId && clientSecret);
  
  return NextResponse.json({ configured });
}