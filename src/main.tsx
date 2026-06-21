import "@radix-ui/themes/styles.css";
import "./styles.css";

import { Theme } from "@radix-ui/themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <Theme
      appearance="light"
      accentColor="indigo"
      grayColor="slate"
      panelBackground="solid"
      radius="small"
      scaling="100%"
    >
      <App />
    </Theme>
  </StrictMode>,
);
