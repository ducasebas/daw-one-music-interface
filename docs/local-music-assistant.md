# Optional Music Assistant server on the Pi

Default: keep the existing MA server/NUC. The TuneBox backend, Squeezelite audio player and MA server are distinct services. Installing one does not install or migrate the others.

Official [installation requirements](https://www.music-assistant.io/installation/), reviewed 4 November 2026: 64-bit OS, Pi4 or newer/equivalent, minimum 2 GB RAM; 4 GB+ recommended when running other software. The Pi3 B+ is not offered a local server. TuneBox uses a **stricter proposed co-hosting policy** for the kiosk plus server: Pi4, OS-visible RAM >=3500 MiB (4 GB class), currently available RAM >=1800 MiB, >=10 GiB free data storage, measured CPU temperature below 70 C, known firmware flags without current undervoltage/throttling, and one-minute load <=half the CPU core count. These are engineering admission choices, not manufacturer safety thresholds or performance guarantees. Historical flags alone do not reject a healthy current state.

## Automatic installer choice

`deploy/install.sh` now defaults to `--target auto`. It detects Pi3 B+ or Pi4 from the device-tree model; unknown boards fail. ARM64 VMs still require explicit `--target vm`. Pi3 uses the existing lightweight UI profile and requires `--prebuilt`.

After the app install, eligible interactive Pi4 installations offer a **default-no** question. Non-interactive runs do not install MA implicitly. Options:

```sh
sudo bash deploy/install.sh --target auto --prebuilt --music-assistant ask
sudo bash deploy/install.sh --target auto --prebuilt --music-assistant skip
```

Only choose explicit `--music-assistant install` if you intend to add a new server. An unsuitable host is rejected before application installation changes. A capacity snapshot cannot predict large-library import, transcoding, storage wear or graphics load; repeat tests with kiosk/audio running before relying on the combined system.

## Docker prerequisite and standalone use

The helper does **not** install Docker through a downloaded root script. Install Docker Engine and the Compose plugin following [Docker's Debian instructions](https://docs.docker.com/engine/install/debian/) for the actual OS release, then confirm `sudo docker info` and `sudo docker compose version` work. No Docker daemon is needed for the normal remote-MA client.

From a trusted extracted release or checkout on the Pi:

```sh
bash deploy/music-assistant-local.sh --assess pi4
sudo bash deploy/music-assistant-local.sh --offer pi4
```

The helper checks resources and only starts a server after explicit consent, existing Docker/Compose, an available web port and no conflicting configuration. It leaves an existing named container/configuration untouched. If Docker or image startup fails, the app install does not become proof of a working MA server.

The optional Compose file follows the official image pattern `ghcr.io/music-assistant/server:latest`, host networking, restart policy and persistent `/data`. The moving `latest` tag is not an immutable release pin; review/pin the version in your saved Compose file for reproducibility. It does not add privileged mode, in-container network mounts or access to Pi GPIO/audio devices. Review any later extra privileges separately.

## What is installed and what is not

- `/etc/daw-one/music-assistant.compose.yml`
- Persistent `/var/lib/daw-one/music-assistant` data
- Container `daw-one-music-assistant`

Host networking allows discovery on the trusted local network; do not expose the server to the Internet. MA's web endpoint is normally port 8095; provider/stream ports and reachable addresses need separate checks. The script does not alter a running NUC, import its database, copy tokens, change `/etc/daw-one.env`, select a player or enable autoplay. Avoid two independently configured servers competing for the same Squeezelite player.

Complete MA onboarding, configure accounts/providers/players and then explicitly point TuneBox at the chosen server with a server-side token. A responding HTTP endpoint is not authenticated playback or audio validation. There is no rollback/backup guarantee; retain data backups before upgrades.

## Logs and removal

```sh
sudo docker logs --tail 80 daw-one-music-assistant
sudo docker compose -p daw-one-ma -f /etc/daw-one/music-assistant.compose.yml stop
```

To remove the container after reviewing the configuration, use the same Compose command with `down`; data is intentionally retained. Do not delete the data directory unless you intend to erase that server's library/configuration. None of this enables real amplifier control.
