"use client";

import LiveScreen from "@/components/live/LiveScreen";
import SetupScreen from "@/components/SetupScreen";
import { useSession } from "@/lib/store";

export default function App() {
  const phase = useSession((s) => s.phase);
  return phase === "setup" ? <SetupScreen /> : <LiveScreen />;
}
