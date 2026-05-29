import { HeadlineTiles } from "@/components/HeadlineTiles";
import { GoldSignalPanel } from "@/components/GoldSignalPanel";
import { FXContext } from "@/components/FXContext";
import { REERPanel } from "@/components/REERPanel";
import { Footer } from "@/components/Footer";
import { HeaderBar } from "@/components/HeaderBar";

export default function Home() {
  return (
    <main
      className="mx-auto max-w-screen-sm px-4 pb-12"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 3rem)",
      }}
    >
      <HeaderBar />

      <div className="flex flex-col gap-4">
        <HeadlineTiles />
        <GoldSignalPanel />
        <FXContext />
        <REERPanel />
      </div>

      <Footer />
    </main>
  );
}
