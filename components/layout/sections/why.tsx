import { icons } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

interface WhyProps {
  icon: string;
  title: string;
  description: string;
}

const whyList: WhyProps[] = [
  {
    icon: "DollarSign",
    title: "Save Money",
    description:
      "Say goodbye to countless subscriptions that turn your bank statements into a horror movie.",
  },
  {
    icon: "Infinity",
    title: "Unlimited Access",
    description:
      "With no in-house restrictions, you and all your friends can join the party.",
  },
  {
    icon: "Code",
    title: "It's Open Source",
    description:
      "NyumatFlix is open source, so you can contribute to the project and make it even better.",
  },
  {
    icon: "TrendingUp",
    title: "Always Up-to-Date",
    description:
      "The catalog is always up-to-date with the latest movies and TV shows.",
  },
];

export function WhyNyumatFlix() {
  return (
    <section id="benefits" className="container py-24 sm:py-32">
      <div className="grid lg:grid-cols-2 place-items-center lg:gap-24">
        <div>
          <h2 className="text-lg text-primary mb-2 tracking-wider">
            Why NyumatFlix?
          </h2>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Your Shortcut to <br />
            <span className="bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text text-transparent">
              Streaming for Free
            </span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Say goodbye to countless subscriptions that turn your bank
            statements into a horror movie. With NyumatFlix, you can watch your
            favorite movies and TV shows all at no cost.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 w-full">
          {whyList.map(({ icon, title, description }, index) => (
            <Card
              key={title}
              className="bg-muted/50 dark:bg-card hover:bg-background transition-all delay-75 group/number"
            >
              <CardHeader>
                <div className="flex justify-between">
                  <Icon
                    name={icon as keyof typeof icons}
                    size={32}
                    color="hsl(var(--primary))"
                    className="mb-6 text-primary"
                  />
                  <span className="text-5xl text-muted-foreground/15 font-medium transition-all delay-75 group-hover/number:text-muted-foreground/30">
                    0{index + 1}
                  </span>
                </div>

                <CardTitle>{title}</CardTitle>
              </CardHeader>

              <CardContent className="text-muted-foreground">
                {description}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
