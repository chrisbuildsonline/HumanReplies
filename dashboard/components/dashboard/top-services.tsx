import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Reply {
  id: string;
  service: string;
  reply_date: string;
  created_at: string;
}

interface TopServicesProps {
  replies: Reply[];
}

export function TopServices({ replies }: TopServicesProps) {
  const serviceCounts = replies.reduce((acc, reply) => {
    acc[reply.service] = (acc[reply.service] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalReplies = replies.length;
  const services = [
    { name: "X", count: serviceCounts["X"] || 0, color: "bg-chart-1" },
    {
      name: "LinkedIn",
      count: serviceCounts["LinkedIn"] || 0,
      color: "bg-chart-2",
    },
    {
      name: "Facebook",
      count: serviceCounts["Facebook"] || 0,
      color: "bg-chart-3",
    },
  ].sort((a, b) => b.count - a.count);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle>Top Services</CardTitle>
        <CardDescription>Your most used social media platforms</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {services.map((service, index) => {
          const percentage =
            totalReplies > 0 ? (service.count / totalReplies) * 100 : 0;
          return (
            <div key={service.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${service.color}`} />
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {service.count} replies
                  </span>
                  <span className="font-medium">{percentage.toFixed(1)}%</span>
                </div>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          );
        })}

        {totalReplies === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No replies generated yet.</p>
            <p className="text-sm mt-1">
              Start using the HumanReplies extension to see your stats here!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
