"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Defer sidebar to client-only rendering.
  // Browser wallet extensions (Phantom SES lockdown, MetaMask) modify JS intrinsics
  // before hydration, causing React error #418. By mounting the sidebar only after
  // hydration, the server HTML never includes it and there's nothing to mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="flex min-h-screen">
      {mounted && <Sidebar />}
      <main className="flex-1 min-w-0 lg:ml-14">
        {children}
      </main>
    </div>
  );
}
