/** TuneBox co-hosting policy, not a benchmark or manufacturer's thermal limit. */
export function localServerAssessment(host = {}) {
  const reasons = [];
  if (host.target !== "pi4")
    reasons.push(
      "Local MA co-hosting is offered only on Pi 4; Pi 3 B+ stays a player/display.",
    );
  if (!["aarch64", "arm64"].includes(host.arch))
    reasons.push("A 64-bit ARM OS is required.");
  for (const [key, minimum, message] of [
    [
      "totalMiB",
      3500,
      "At least the 4 GB RAM class is required for this combined kiosk/server policy.",
    ],
    [
      "availableMiB",
      1800,
      "At least 1800 MiB currently available RAM is required.",
    ],
    ["freeDiskMiB", 10240, "At least 10 GiB free data storage is required."],
  ])
    if (!Number.isFinite(host[key]) || host[key] < minimum)
      reasons.push(message);
  if (!Number.isFinite(host.temperatureC) || host.temperatureC >= 70)
    reasons.push(
      "Temperature must be measured and below the proposed 70 C co-hosting threshold.",
    );
  if (
    !Number.isInteger(host.throttled) ||
    host.throttled < 0 ||
    (host.throttled & 0xf) !== 0
  )
    reasons.push(
      "Firmware health must be known, without current undervoltage/throttling flags.",
    );
  if (
    !Number.isFinite(host.load1) ||
    !Number.isInteger(host.cores) ||
    host.cores < 1 ||
    host.load1 > host.cores / 2
  )
    reasons.push(
      "One-minute load must be known and no more than half the CPU core count.",
    );
  return {
    eligible: reasons.length === 0,
    reasons,
    host,
    note: "Snapshot only: does not predict library sync, transcoding, graphics, storage wear or stable playback. Docker/Compose and explicit consent are separately required.",
  };
}
