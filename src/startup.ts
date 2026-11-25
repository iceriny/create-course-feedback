void import("./main").catch((error: unknown) => {
  console.error("工作台加载失败", error);
  document.getElementById("startup-screen")?.setAttribute("data-failed", "");
  document
    .getElementById("startup-logo")
    ?.setAttribute("src", `${import.meta.env.BASE_URL}logo.svg`);
});
