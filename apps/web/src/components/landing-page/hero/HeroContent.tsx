export function HeroContent() {
  return (
    <div className="relative z-10 mx-auto w-full sm:w-[88%] md:w-[85%] lg:w-[80%] xl:w-[80%] max-w-[1920px] md:overflow-x-hidden overflow-y-visible min-[120rem]:overflow-visible px-4 sm:px-4 md:px-5 lg:px-6 xl:px-8 2xl:px-10 min-[97.5rem]:px-12">
      <div className="grid md:grid-cols-2 gap-6 sm:gap-7 md:gap-8 lg:gap-10 xl:gap-12 2xl:gap-16 min-[97.5rem]:gap-20 items-start md:min-h-[380px] lg:min-h-[470px] xl:min-h-[760px] min-[120rem]:min-h-[860px]">
        <div className="md:pl-2 lg:pl-7 xl:pl-3 2xl:pl-13 min-[97.5rem]:pl-15 min-[120rem]:pl-17 lg:pr-6 xl:pr-8">
          <div className="text-center md:text-left mt-0 sm:mt-2 md:mt-0 lg:mt-7 xl:mt-8 2xl:mt-9">
            <h1 className="font-serif text-2xl sm:text-2xl md:text-[26px] lg:text-[40px] xl:text-[45px] min-[97.5rem]:text-[50px] leading-tight lg:leading-[1.08] tracking-tight text-white mb-6 md:mb-8">
              <span className="block 2xl:whitespace-nowrap">
               Complex workflows. 
              </span>
              <span className="block 2xl:whitespace-nowrap">
                Reliable execution.
              </span>
            </h1>

            <p className="max-w-xl 2xl:max-w-2xl mx-auto md:mx-0 text-sm lg:text-[17px] xl:text-[14px] 2xl:text-[18px] min-[97.5rem]:text-[18px] text-[#A1A1AA] mb-10 md:mb-10 leading-relaxed font-sans">
             Orchestrate tasks with built-in retries, checkpointing, and fault-tolerant execution.
            </p>
          </div>

          <div className="relative mx-auto md:hidden w-full max-w-[420px] h-[220px] sm:h-[250px] mb-12 sm:mb-10 overflow-visible">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.42] sm:scale-[0.4]">
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

        <div className="relative hidden md:block perspective-[2000px] -mt-4 md:mt-9.5 lg:mt-7 md:ml-0 xl:ml-14 min-[97.5rem]:ml-0 z-10">
        </div>
      </div>
    </div>
  );
}