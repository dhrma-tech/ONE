import "./one-bridge";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import App from "./App";
import "./styles/app.css";
import "./styles/one-theme.css";
import { initPython } from "./bridge/py";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// Start loading Pyodide + bobby in the background; the board never waits for it.
void initPython();

if ("serviceWorker" in navigator && import.meta.env.PROD) addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => { /* not installable here */ }); });
