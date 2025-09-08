import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Reply {
  id: string
  service: string
  reply_date: string
  created_at: string
}

interface RecentActivityProps {
  replies: Reply[]
}

export function RecentActivity({ replies }: RecentActivityProps) {
  const recentReplies = replies.slice(0, 10)

  const getServiceColor = (service: string) => {
    switch (service) {
      case "X":
        return "bg-chart-1/10 text-chart-1 border-chart-1/20"
      case "LinkedIn":
        return "bg-chart-2/10 text-chart-2 border-chart-2/20"
      case "Facebook":
        return "bg-chart-3/10 text-chart-3 border-chart-3/20"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}d ago`
    }
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest reply generations</CardDescription>
      </CardHeader>
      <CardContent>
        {recentReplies.length > 0 ? (
          <div className="space-y-3">
            {recentReplies.map((reply) => (
              <div key={reply.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={getServiceColor(reply.service)}>
                    {reply.service}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Reply generated</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(reply.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No recent activity.</p>
            <p className="text-sm mt-1">Your reply generations will appear here once you start using the extension.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
