import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Reply {
  id: string
  service: string
  reply_date: string
  created_at: string
}

interface DashboardStats {
  total_replies: number
  today_replies: number
  week_replies: number
  month_replies: number
}

interface StatsOverviewProps {
  replies: Reply[]
  dashboardStats?: DashboardStats | null
}

export function StatsOverview({ replies, dashboardStats }: StatsOverviewProps) {
  // Use dashboard stats if available, otherwise fallback to manual calculation
  const totalReplies = dashboardStats?.total_replies ?? replies.length
  const todayReplies = dashboardStats?.today_replies ?? (() => {
    const today = new Date().toISOString().split("T")[0]
    return replies.filter((reply) => reply.reply_date === today).length
  })()
  const weekReplies = dashboardStats?.week_replies ?? (() => {
    const thisWeek = new Date()
    thisWeek.setDate(thisWeek.getDate() - 7)
    return replies.filter((reply) => new Date(reply.reply_date) >= thisWeek).length
  })()
  const monthReplies = dashboardStats?.month_replies ?? (() => {
    const thisMonth = new Date()
    thisMonth.setDate(1)
    return replies.filter((reply) => new Date(reply.reply_date) >= thisMonth).length
  })()

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
