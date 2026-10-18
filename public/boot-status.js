// Keep module/network failures readable before React can mount.
(() => {
  const report = () => {
    const status = document.getElementById("boot-status");
    if (status)
      status.textContent =
        "DAW ONE kon niet laden. Ververs de pagina. Blijft dit staan? Controleer of npm run dev draait en of je poort 5173 opent. Versie display-r3.";
  };
  window.addEventListener("error", report, true);
  window.addEventListener("unhandledrejection", report);
  window.setTimeout(report, 15000);
})();
