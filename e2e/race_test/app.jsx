import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useAsyncData } from "../../src/parent-app/hooks/useAsyncData.js";

// Simulates: switching FROM a slow-resolving request TO a fast one that
// starts LATER but finishes FIRST — the exact scenario in the bug report.
const fetchers = {
  A: () => new Promise(resolve => setTimeout(() => resolve("RESULT_A"), 500)), // starts first, resolves LAST
  B: () => new Promise(resolve => setTimeout(() => resolve("RESULT_B"), 100)), // starts second, resolves FIRST
};

function TestComponent() {
  const [key, setKey] = useState("A");
  const { data } = useAsyncData(fetchers[key], [key]);
  window.__setKey = setKey; // driven externally by the test script
  return <div id="result">{data || "loading"}</div>;
}

createRoot(document.getElementById("root")).render(<TestComponent />);
