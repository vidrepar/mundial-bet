"use client";

import { useQuery } from "@tanstack/react-query";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/trpc/client";

export default function AwardsPage() {
  const trpc = useTRPC();
  const q = useQuery(trpc.awards.list.queryOptions());
  const awards = q.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Awards</h1>
        <p className="text-sm text-muted-foreground">
          Season-long bragging rights. Updated live as results land.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {awards.map((a) => (
          <Card key={a.key} className="relative overflow-hidden">
            {a.winner && <BorderBeam size={120} duration={9} />}
            <CardContent className="flex items-center gap-4">
              <div className="text-4xl">{a.emoji}</div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
                {a.winner ? (
                  <div className="mt-2 flex items-center gap-2">
                    <UserAvatar
                      name={a.winner.name}
                      image={a.winner.image}
                      className="size-7"
                    />
                    <span className="font-semibold">{a.winner.name}</span>
                    <Badge variant="success" className="ml-auto">
                      {a.winner.display}
                    </Badge>
                  </div>
                ) : (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Up for grabs…
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
