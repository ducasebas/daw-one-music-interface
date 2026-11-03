# System-wide Node.js on Raspberry Pi OS Lite ARM64

TuneBox needs Node.js **22.12 or newer**, including native WebSocket support, and npm. Node.js 24 LTS is recommended. Install on the Pi itself; the Mac's Node installation does not transfer with the application bundle. A user-only nvm installation is not sufficient unless explicitly made available to sudo/systemd.

First check:

```sh
uname -m
node --version
npm --version
sudo /usr/bin/env node --version
sudo /usr/bin/env npm --version
```

The architecture must be `aarch64` (or `arm64`). If these runtime checks already succeed with a supported version, skip installation.

## NodeSource package option

This adds the **third-party NodeSource APT repository** for Node 24. It is not a Raspberry Pi or Node.js project repository. Review the downloaded setup script and its current supported Debian releases before running it. This route was used during the owner's setup; it has not been independently executed on a Pi by cloud tests. The TuneBox installer does not install Node automatically.

On the Pi:

```sh
sudo apt-get update &&
sudo apt-get install -y ca-certificates curl &&
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/tunebox-nodesource-setup.sh
```

Review the downloaded file, then install:

```sh
less /tmp/tunebox-nodesource-setup.sh
```

Press `q` to leave the viewer. If you accept the repository setup:

```sh
sudo bash /tmp/tunebox-nodesource-setup.sh &&
sudo apt-get install -y nodejs
```

Repeat all version checks above. Do not continue the TuneBox installation if any fail. Alternatively install an official Linux ARM64 binary from [Node.js downloads](https://nodejs.org/en/download), verifying its published checksum and making both node/npm system-wide. Avoid replacing a working runtime without checking existing applications.
