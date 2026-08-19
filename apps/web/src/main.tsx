import "@xyflow/react/dist/style.css";
import "@linktag/app/styles.css";

import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "@linktag/app";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App browserWindows={[]} runtime="web" showWindowGroupLayoutSelector={false} />
  </React.StrictMode>,
);
