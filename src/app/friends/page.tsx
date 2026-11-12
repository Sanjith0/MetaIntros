import { TabBar, TopBar } from "@/components/ui";

export default function Page() {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar />
      <main className="flex-1 p-4">
        <h1 className="text-2xl font-bold">Friends</h1>
        <p className="text-sub mt-2">Not part of the Crews prototype.</p>
      </main>
      <TabBar active="/friends" />
    </div>
  );
}
