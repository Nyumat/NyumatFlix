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
    question: "Is this going to give me viruses?",
    answer: "No, not at all. This is a safe website.",
    value: "item-1",
  },
  {
    question: "How can I request a feature?",
    answer:
      "You can request a feature by filling out the contact form on the contact page.",
    value: "item-2",
  },
  {
    question: "Where is the source code for this website? Can I contribute?",
    answer:
      "The source code for this website is available on GitHub (and linked in the navbar) And yes, you can contribute—just submit a pull request!",
    value: "item-3",
  },
  {
    question: "How did you get this idea?",
    answer:
      "I got this idea from a friend who wanted to watch movies without having to spend $10 a month on a subscription. I decided to make this website to help people like him. Hopefully, I can help you too.",
    value: "item-4",
  },
  {
    question: "What is the best way to watch movies and TV shows?",
    answer: "NyumatFlix, duh!",
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
