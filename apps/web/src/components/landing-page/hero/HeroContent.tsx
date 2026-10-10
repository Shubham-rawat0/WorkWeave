import { WorkflowGraph } from "./WorkflowGraph";

export function HeroContent() {
  return (
    <div className="relative z-10 mx-auto w-full sm:w-[88%] md:w-[85%] lg:w-[80%] xl:w-[80%] max-w-[1920px] md:overflow-x-hidden overflow-y-visible min-[120rem]:overflow-visible px-4 sm:px-4 md:px-5 lg:px-6 xl:px-8 2xl:px-10 min-[97.5rem]:px-12">
      <div className="grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-6 sm:gap-7 md:gap-8 lg:gap-10 xl:gap-12 2xl:gap-16 min-[97.5rem]:gap-20 items-start md:min-h-[380px] lg:min-h-[470px] xl:min-h-[760px] min-[120rem]:min-h-[860px]">
        <div className="md:pl-2 lg:pl-7 xl:pl-3 2xl:pl-13 min-[97.5rem]:pl-15 min-[120rem]:pl-17 lg:pr-6 xl:pr-8">
          <div className="text-center md:text-left mt-0 sm:mt-2 md:mt-0 lg:mt-7 xl:mt-8 2xl:mt-9">
            <h1 className="font-serif text-2xl sm:text-2xl md:text-[26px] lg:text-[40px] xl:text-[45px] min-[97.5rem]:text-[50px] leading-tight lg:leading-[1.08] tracking-tight text-white mb-6 md:mb-8">
              <span className="block 2xl:whitespace-nowrap">
               Complex workflows.{" "}
              </span>
              <span className="block 2xl:whitespace-nowrap">
                Reliable execution.
              </span>
            </h1>

            <p className="max-w-xl 2xl:max-w-2xl mx-auto md:mx-0 text-sm lg:text-[17px] xl:text-[14px] 2xl:text-[18px] min-[97.5rem]:text-[18px] text-[#A1A1AA] mb-10 md:mb-10 leading-relaxed font-sans">
            WorkWeave lets you visually create, connect, and run tasks. With built-in retries, checkpoints, and fault-tolerant execution, it helps keep workflows reliable from start to finish.</p>
          </div>

          {/* Mobile workflow graph */}
          <div className="relative mx-auto md:hidden w-full max-w-[560px] mb-10 sm:mb-8">
            <div
              className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3"
              style={{ aspectRatio: "800 / 700" }}
            >
              <WorkflowGraph />
            </div>
          </div>

          <div className="relative mx-auto flex w-fit max-w-full flex-row flex-nowrap items-center justify-center gap-2 sm:gap-3 md:mx-0 md:w-full md:justify-start md:gap-4 mt-25 mb-6 sm:mb-4 md:mb-0 md:mt-8 lg:mt-0">
            <a
              href="/home"
              className="group shrink-0 flex items-center gap-0.5 whitespace-nowrap bg-[#F04D26] hover:bg-[#F04D26]/90 text-white rounded-[11px] md:rounded-[12px] pl-3 pr-2.5 md:pl-4 md:pr-3.5 min-[97.5rem]:pl-5 min-[97.5rem]:pr-4 h-9 md:h-10 lg:h-10 xl:h-10 2xl:h-11 min-[97.5rem]:h-12 text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base min-[97.5rem]:text-base font-medium shadow-sm transition-[background-color,transform] duration-150 ease focus:outline-none active:scale-[0.97] motion-reduce:transition-none"
            >
              Get Started
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 20"
                className="size-4 md:size-[17px] lg:size-[17px] 2xl:size-[18px] transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="square"
                  strokeWidth="1.25"
                  d="M8.333 13.333 11.667 10 8.333 6.667"
                ></path>
              </svg>
            </a>
          </div>
        </div>

        {/* Desktop workflow graph */}
        <div className="relative hidden md:flex items-start justify-center perspective-[2000px] -mt-4 md:mt-9.5 lg:mt-7 md:ml-0 xl:ml-14 min-[97.5rem]:ml-0 z-10">
          <div
            className="w-full rounded-2xl border border-[#272727] bg-[#1a1a1a] p-5 xl:p-6 shadow-[0_2px_24px_rgba(0,0,0,0.45)]"
            style={{ aspectRatio: "800 / 700" }}
          >
            <WorkflowGraph />
          </div>
        </div>
      </div>
    </div>
  );
}