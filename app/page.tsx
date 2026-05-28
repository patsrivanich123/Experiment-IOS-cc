import { HeadlineTiles } from "@/components/HeadlineTiles";
import { GoldSignalPanel } from "@/components/GoldSignalPanel";
import { FXContext } from "@/components/FXContext";
import { REERPanel } from "@/components/REERPanel";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main
      className="mx-auto max-w-screen-sm px-4 pb-12"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 3rem)",
      }}
    >
      <header className="mb-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-violet/20 ring-1 ring-accent/30">
            <span className="text-[15px] font-semibold leading-none text-accent">
              ฿
            </span>
          </div>
          <h1 className="text-[20px] font-semibold leading-none tracking-tight">
            THB Dashboard
          </h1>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-soft">
          Macro signals for the Thai baht. Updated on every refresh.
        </p>
      </header>

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
