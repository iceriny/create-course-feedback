import { initializeMotionPreference } from "./motion/preference";

async function start() {
  initializeMotionPreference();
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_DEMO === "1") {
    const { seedDemoData } = await import("./dev/seedDemoData");
    seedDemoData();
  }
  await import("./main");
}

void start().catch((error: unknown) => {
  console.error("工作台加载失败", error);
  document.getElementById("startup-screen")?.setAttribute("data-failed", "");
});
