import React from "react";
import { release, buildAlignment } from "../shared/release.js";
const info =
  typeof __DAW_BUILD_INFO__ === "undefined"
    ? { revision: "source", createdAt: null }
    : __DAW_BUILD_INFO__;
export function BuildBadge({ snapshot, offline = false }) {
  const state = buildAlignment(release, snapshot?.build, offline);
  const suffix =
    state === "mismatch"
      ? " · BACKEND ANDERE VERSIE"
      : state === "unknown"
        ? " · BACKENDVERSIE ONBEKEND"
        : state === "offline"
          ? " · OFFLINE"
          : "";
  return (
    <span
      className="build-badge"
      data-build={release.id}
      data-alignment={state}
      aria-label="Softwareversie"
      title={`Frontend: ${release.id}\nGit: ${info.revision}\nBuild: ${info.createdAt || "development"}\nBackend: ${snapshot?.build?.id || "unknown"}\nBij afwijking: stop de server, git pull, herstart en herlaad de browser.`}
    >
      {release.label}
      <span className="build-revision"> · {info.revision}</span>
      {suffix}
    </span>
  );
}
