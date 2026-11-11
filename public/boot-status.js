// Keep module/network failures readable before React can mount.
(() => {
  const query=new URLSearchParams(location.search);
  if(query.get('screen')==='1'&&query.get('display')==='dsi-production')document.documentElement.dataset.tuneboxKiosk='true';
  const report = () => {
    const status = document.getElementById("boot-status");
    if (status)
      status.textContent =
        "TuneBox could not load. Reload the page. If this persists, check the backend and kiosk logs. · display-r3";
  };
  window.addEventListener("error", report, true);
  window.addEventListener("unhandledrejection", report);
  window.setTimeout(report, 15000);
})();
