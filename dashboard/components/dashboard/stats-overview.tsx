import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Reply {
  id: string
  service: string
  reply_date: string
  created_at: string
}

interface StatsOverviewProps {
  replies: Reply[]
}

export function StatsOverview({ replies }: StatsOverviewProps) {
  const totalReplies = replies.length
  const today = new Date().toISOString().split("T")[0]
  const todayReplies = replies.filter((reply) => reply.reply_date === today).length

  const thisWeek = new Date()
  thisWeek.setDate(thisWeek.getDate() - 7)
  const weekReplies = replies.filter((reply) => new Date(reply.reply_date) >= thisWeek).length

  const thisMonth = new Date()
  thisMonth.setDate(1)
  const monthReplies = replies.filter((reply) => new Date(reply.reply_date) >= thisMonth).length

  const stats = [
    {
      title: "Total Replies",
      value: totalReplies.toLocaleString(),
      description: "All time replies generated",
    },
    {
      title: "Today",
      value: todayReplies.toLocaleString(),
      description: "Replies generated today",
    },
    {
      title: "This Week",
      value: weekReplies.toLocaleString(),
      description: "Replies in the last 7 days",
    },
    {
      title: "This Month",
      value: monthReplies.toLocaleString(),
      description: "Replies this month",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
