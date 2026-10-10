import { Footer } from "@/components/landing-page/footer"
import Header from "@/components/landing-page/header"
import { FeaturesSection } from "@/components/landing-page/hero/Features"
import Hero from "@/components/landing-page/hero/hero"
import { SectionSeparators } from "@/components/landing-page/hero/Section-seperator"
import { ScrollArea } from "@/components/ui/scroll-area"

function Home() {
  return (
  <main className="h-screen bg-[var(--bg)] text-[var(--text)]">
    <ScrollArea type="scroll" scrollHideDelay={500} className="h-full w-full">
        <Header/>
        <Hero/>
        <div className="w-[90%] sm:w-[88%] md:w-[85%] lg:w-[80%] xl:w-[80%] mx-auto md:px-4 lg:px-6 xl:px-8 max-w-[1400px] 2xl:max-w-[1560px] min-[120rem]:max-w-[1700px]">
          <SectionSeparators />

          <div className="snap-y snap-mandatory">
            <FeaturesSection />
            {/* todo 
            
            background
            
            palyground
            */}
          </div>

        </div>

        <div className="w-[90%] sm:w-[88%] md:w-[85%] lg:w-[80%] xl:w-[80%] mx-auto md:px-4 lg:px-6 xl:px-8 max-w-[1400px] 2xl:max-w-[1560px] min-[120rem]:max-w-[1700px]">
          <Footer />
        </div>
      </ScrollArea>
      </main>
  )
}
export default Home
