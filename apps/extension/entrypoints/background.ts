import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command) => {
    if (command !== "collect-current-page") return;
    void openCollectPopup();
  });
});

async function openCollectPopup() {
  const action = browser.action as { openPopup?: () => Promise<void> };
  if (!action.openPopup) {
    console.error("[LinkTag] 当前浏览器不支持通过快捷键打开扩展弹窗");
    return;
  }
  await browser.storage.local.set({ linktagPopupIntent: "collect" });
  try {
    await action.openPopup();
  } catch (error) {
    await browser.storage.local.remove("linktagPopupIntent");
    throw error;
  }
}
