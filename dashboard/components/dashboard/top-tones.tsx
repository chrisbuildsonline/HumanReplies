import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Tone {
  tone: string;
  count: number;
  percentage: number;
}

interface TopTonesProps {
  topTones: Tone[];
}

// Color palette for different tones
const getToneColor = (index: number) => {
  const colors = [
    "bg-chart-1",
    "bg-chart-2", 
    "bg-chart-3",
    "bg-chart-4",
    "bg-chart-5"
  ];
  return colors[index % colors.length];
};

// Format tone names for display
const formatToneName = (tone: string) => {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
};

export function TopTones({ topTones }: TopTonesProps) {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle>Most used</CardTitle>
        <CardDescription>Most used preset tones</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {topTones.length > 0 ? (
          topTones.map((tone, index) => (
            <div key={tone.tone} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getToneColor(index)}`} />
                  <span className="font-medium">{formatToneName(tone.tone)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {tone.count} replies
                  </span>
                  <span className="font-medium">{tone.percentage}%</span>
                </div>
              </div>
              <Progress value={tone.percentage} className="h-2" />
            </div>
          ))
        ) : (
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
