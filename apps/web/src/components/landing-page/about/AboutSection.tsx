const QUESTIONS = [
  {
    question: "What is WorkWeave for?",
    answer:
      "WorkWeave helps you build and run automated workflows that connect steps like triggers, conditions, and actions. It gives you one visual place to design the flow and follow each run from start to finish.",
  },
  {
    question: "Who is it for?",
    answer:
      "It is for teams and builders who want to automate repeatable work, make branching processes easier to manage, and understand what happened when a workflow runs.",
  },
  {
    question: "What happens when a step fails?",
    answer:
      "WorkWeave tracks each step’s status and error details, and can retry failed steps so completed work does not have to run again. You can inspect the run history to see where a workflow needs attention.",
  },
];

export function AboutSection() {
  return (
    <section
      id="about"
      className="relative bg-[#151515] px-4 py-16 sm:py-20 md:py-24 lg:py-28 xl:py-32"
    >
      <div className="mx-auto w-full max-w-[1400px] px-0 sm:px-4 md:px-5 lg:px-6 xl:px-8">
        <div className="mb-10 text-center sm:mb-12 md:mb-14">
          <div className="mb-4 flex items-center justify-center">
            <span className="inline-flex h-6 items-center rounded-md border border-[#F04D26]/40 bg-[#F04D26]/[0.08] px-2 text-[10px] font-semibold tracking-widest text-[#F04D26]/80">
              ABOUT WORKWEAVE
            </span>
          </div>
          <h2 className="mx-auto max-w-3xl text-balance font-serif text-3xl font-normal leading-[1.08] tracking-tight text-white sm:text-4xl md:text-[42px] lg:text-[52px] xl:text-[58px]">
            Automation you can understand and trust.
          </h2>
        </div>

        <div className="mx-auto max-w-4xl divide-y divide-white/10 border-y border-white/10">
          {QUESTIONS.map(({ question, answer }) => (
            <article key={question} className="grid gap-3 py-6 sm:grid-cols-[0.8fr_1.2fr] sm:gap-8 sm:py-8">
              <h3 className="font-serif text-xl font-normal tracking-tight text-white sm:text-2xl">
                {question}
              </h3>
              <p className="text-sm leading-7 text-[#8a8a87] sm:text-[15px]">
                {answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
