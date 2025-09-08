"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts"

interface Reply {
  id: string
  service: string
  reply_date: string
  created_at: string
}

interface ReplyChartProps {
  replies: Reply[]
}

export function ReplyChart({ replies }: ReplyChartProps) {
  // Get last 7 days of data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return date.toISOString().split("T")[0]
  }).reverse()

  const chartData = last7Days.map((date) => {
    const dayReplies = replies.filter((reply) => reply.reply_date === date)
    const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "short" })

    return {
      day: dayName,
      date,
      total: dayReplies.length,
      X: dayReplies.filter((r) => r.service === "X").length,
      LinkedIn: dayReplies.filter((r) => r.service === "LinkedIn").length,
      Facebook: dayReplies.filter((r) => r.service === "Facebook").length,
    }
  })

  const chartConfig = {
    total: {
      label: "Total Replies",
      color: "hsl(var(--primary))",
    },
    X: {
      label: "X (Twitter)",
      color: "hsl(var(--chart-1))",
    },
    LinkedIn: {
      label: "LinkedIn",
      color: "hsl(var(--chart-2))",
    },
    Facebook: {
      label: "Facebook",
      color: "hsl(var(--chart-3))",
    },
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle>Daily Activity</CardTitle>
        <CardDescription>Your reply generation over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
