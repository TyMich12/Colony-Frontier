import { createRoot } from "react-dom/client";
import App from "./App";
import { SoundSystemProvider } from "./components/mockups/colony-frontier/_shared/SoundSystem";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <SoundSystemProvider>
    <App />
  </SoundSystemProvider>,
);
