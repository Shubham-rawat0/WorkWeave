import { Footer } from "@/components/landing-page/footer"
import Header from "@/components/landing-page/header"
import { ScrollArea } from "@/components/ui/scroll-area"

function Home() {
  return (
  <main className="h-screen bg-[var(--bg)] text-[var(--text)]">
    <ScrollArea type="scroll" scrollHideDelay={500} className="h-full w-full">
        <Header/>
        <div className="h-screen">lol</div>
        <Footer/>
    </ScrollArea>
  </main>
  )
}
export default Home
