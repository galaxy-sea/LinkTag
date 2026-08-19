import "@xyflow/react/dist/style.css";
import "@linktag/app/styles.css";

import { App } from "@linktag/app";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";

import {
  getBrowserWindows,
  openExtensionShortcutSettings,
  openLinksInBrowser,
  readBrowserBookmarkData,
  readCollectCurrentPageShortcut,
  writeBrowserBookmarkBackup,
} from "../../src/browser-data";
import type { BrowserWindow } from "@linktag/app";

function NewtabRoot() {
  const [windows, setWindows] = useState<BrowserWindow[]>([]);
  const [collectShortcut, setCollectShortcut] = useState("");
  const windowsSignatureRef = useRef("");

  useEffect(() => {
    let disposed = false;
    let refreshTimer = 0;
    let refreshRunning = false;
    let refreshQueued = false;

    const refresh = async () => {
      if (refreshRunning) {
        refreshQueued = true;
        return;
      }
      refreshRunning = true;
      try {
        const nextWindows = await getBrowserWindows();
        const nextSignature = windowsSignature(nextWindows);
        if (!disposed && nextSignature !== windowsSignatureRef.current) {
          windowsSignatureRef.current = nextSignature;
          setWindows(nextWindows);
        }
      } finally {
        refreshRunning = false;
        if (!disposed && refreshQueued) {
          refreshQueued = false;
          scheduleRefresh(120);
        }
      }
    };
    const scheduleRefresh = (delay = 250) => {
      if (disposed || refreshTimer) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = 0;
        void refresh();
      }, delay);
    };
    const refreshSoon = () => scheduleRefresh();

    void refresh();
    browser.tabs.onCreated.addListener(refreshSoon);
    browser.tabs.onUpdated.addListener(refreshSoon);
    browser.tabs.onRemoved.addListener(refreshSoon);
    browser.tabs.onMoved.addListener(refreshSoon);
    browser.tabs.onAttached.addListener(refreshSoon);
    browser.tabs.onDetached.addListener(refreshSoon);
    browser.tabs.onReplaced.addListener(refreshSoon);
    browser.windows.onCreated.addListener(refreshSoon);
    browser.windows.onRemoved.addListener(refreshSoon);
    browser.windows.onFocusChanged.addListener(refreshSoon);
    const fallbackTimer = window.setInterval(() => scheduleRefresh(0), 30_000);
    return () => {
      disposed = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.clearInterval(fallbackTimer);
      browser.tabs.onCreated.removeListener(refreshSoon);
      browser.tabs.onUpdated.removeListener(refreshSoon);
      browser.tabs.onRemoved.removeListener(refreshSoon);
      browser.tabs.onMoved.removeListener(refreshSoon);
      browser.tabs.onAttached.removeListener(refreshSoon);
      browser.tabs.onDetached.removeListener(refreshSoon);
      browser.tabs.onReplaced.removeListener(refreshSoon);
      browser.windows.onCreated.removeListener(refreshSoon);
      browser.windows.onRemoved.removeListener(refreshSoon);
      browser.windows.onFocusChanged.removeListener(refreshSoon);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const refreshShortcut = async () => {
      const shortcut = await readCollectCurrentPageShortcut();
      if (!disposed) setCollectShortcut(shortcut);
    };

    void refreshShortcut();
    window.addEventListener("focus", refreshShortcut);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refreshShortcut);
    };
  }, []);

  return (
    <App
      browserWindows={windows}
      runtime="extension"
      readBrowserBookmarks={readBrowserBookmarkData}
      writeBrowserBookmarkBackup={writeBrowserBookmarkBackup}
      collectShortcut={collectShortcut}
      onOpenShortcutSettings={() => void openExtensionShortcutSettings()}
      onOpenLinks={(links, title, mode) => void openLinksInBrowser(links, title, mode)}
    />
  );
}

function windowsSignature(windows: BrowserWindow[]) {
  return JSON.stringify(
    windows.map((window) => ({
      id: window.id,
      tabs: window.tabs.map((tab) => ({
        id: tab.id,
        linkId: tab.linkId,
        title: tab.title,
        url: tab.url,
        favicon: tab.favicon,
      })),
    })),
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NewtabRoot />
  </React.StrictMode>,
);
