import { Footer } from "@/components/landing-page/footer"
import { AboutSection } from "@/components/landing-page/about/AboutSection"
import Header from "@/components/landing-page/header"
import { FeaturesSection } from "@/components/landing-page/hero/Features"
import Hero from "@/components/landing-page/hero/hero"
import { SectionSeparators } from "@/components/landing-page/hero/Section-seperator"
import { Playground } from "@/components/landing-page/playground/desktopPlayground"
import { ScrollArea } from "@/components/ui/scroll-area"

function Home() {
  return (
  <main className="h-screen bg-[var(--bg)] text-[var(--text)]">
    <ScrollArea type="scroll" scrollHideDelay={500} className="h-full w-full">
        <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 z-20 hidden w-[80%] max-w-[1920px] -translate-x-1/2 border-x border-white/20 lg:block"
        />
        <Header/>
        <Hero/>
        <div className="w-[90%] sm:w-[88%] md:w-[85%] lg:w-[80%] xl:w-[80%] mx-auto md:px-4 lg:px-6 xl:px-8 max-w-[1400px] 2xl:max-w-[1560px] min-[120rem]:max-w-[1700px]">
          <SectionSeparators />

          <div className="snap-y snap-mandatory">
            <FeaturesSection />
             <SectionSeparators />
            <Playground/>

             <SectionSeparators />
            <AboutSection />
          </div>

    
           
        </div>

        <div className="w-[90%] sm:w-[88%] md:w-[85%] lg:w-[80%] xl:w-[80%] mx-auto md:px-4 lg:px-6 xl:px-8 max-w-[1400px] 2xl:max-w-[1560px] min-[120rem]:max-w-[1700px]">
          <Footer />
        </div>
        </div>
      </ScrollArea>
      </main>
  )
}
export default Home
