# Security and private deployment

TuneBox is a local development/device prototype. The HTTP API does not provide application login or multi-user authorisation. It can control the selected real player when explicitly enabled. Production defaults to loopback; do not expose it directly to the Internet or a public Codespaces port. Use a trusted local session, private forwarding or an SSH tunnel. Vite's development server is for trusted development networks.

Keep MA tokens backend-only, outside Git and browser storage. Use a least-privilege MA account/token where supported. Never attach `.env`, token files, shell history, raw personal playback state or unreviewed logs to public issues. A hash manifest checks consistency; it does not authenticate an untrusted release archive.

Report suspected vulnerabilities through GitHub private vulnerability reporting if enabled. Otherwise open a minimal issue asking for a private contact without exploit details, credentials or personal data. There is no promised response time or supported production/security release policy yet.

The hardware safety simulation is not an electrical protection system. It does not certify an amplifier, controller firmware or physical shutdown circuit. Refer to `docs/hardware.md` before any real hardware enablement.
