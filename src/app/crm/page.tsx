"use client";

import { LoadingProvider } from "./ui/loading-overlay";
import { CrmShell } from "./components/crm-shell";

export default function CrmPage() {
  return (
    <LoadingProvider>
      <CrmShell />
    </LoadingProvider>
  );
}
