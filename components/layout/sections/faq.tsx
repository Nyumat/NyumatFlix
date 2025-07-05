import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface FAQProps {
  question: string;
  answer: string;
  value: string;
}

const FAQList: FAQProps[] = [
  {
    question: 'Why do I need an adblocker if Nyumatflix is "ad-free"?',
    answer:
      "We do not host any content on our servers. We only provide links to third-party websites such as 2embed, etc. These third parties often inject scripts into their iframes (the elements that play the movies/tv shows) - to display ads. We recommend using an adblocker to block these ads - as Nyumatflix itself is ad-free!",
    value: "item-0",
  },
  {
    question: "Where is the source code for this website?",
    answer:
      "The source code for this website is available on GitHub. You can contribute—just submit a pull request! 😜",
    value: "item-3",
  },
  {
    question: "How did you get this idea?",
    answer:
      "I got tired of paying an ever increasing amount of money on streaming services. Nyumatflix was the culmination of my frustration.",
    value: "item-4",
  },
  {
    question: "What is the best way to watch movies and TV shows?",
    answer:
      "Nyumatflix, duh! (But let's be real, there's 1000s of us - which makes this site so much better!)",
    value: "item-5",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="container md:w-[700px] py-24 sm:py-32">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          Got a Question?
        </h2>

        <h2 className="text-3xl md:text-4xl text-center font-bold">
          Frequently Asked Questions
        </h2>
      </div>

      <Accordion type="single" collapsible className="AccordionRoot">
        {FAQList.map(({ question, answer, value }) => (
          <AccordionItem
            key={value}
            value={value}
            className={cn("border-none ring-[0.3px] ring-primary/50")}
          >
            <AccordionTrigger className="text-left">
              {question}
            </AccordionTrigger>

            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
