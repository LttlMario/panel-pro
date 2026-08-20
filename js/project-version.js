(() => {
  "use strict";

  window.PANEL_RELEASE = Object.freeze({
    version: "3.11.5",
    releasedAt: "2026-08-20",
    changelogUrl: "changelog.html",
    developerUrl: "developer.html"
  });

  function applyVersion() {
    document.querySelectorAll("[data-panel-version]").forEach((element) => {
      element.textContent = `v${window.PANEL_RELEASE.version}`;
    });
    document.querySelectorAll("[data-panel-release-date]").forEach((element) => {
      element.textContent = window.PANEL_RELEASE.releasedAt;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyVersion, { once: true });
  } else {
    applyVersion();
  }
})();
