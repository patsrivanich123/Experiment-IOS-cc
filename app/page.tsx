import { HeadlineTiles } from "@/components/HeadlineTiles";
import { GoldSignalPanel } from "@/components/GoldSignalPanel";
import { FXContext } from "@/components/FXContext";
import { REERPanel } from "@/components/REERPanel";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="mx-auto max-w-screen-sm px-4 pt-5 pb-10">
      <header className="mb-5">
        <h1 className="text-xl font-semibold leading-tight">THB Dashboard</h1>
        <p className="mt-1 text-xs text-muted">
          Macro signals for the Thai baht.
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
