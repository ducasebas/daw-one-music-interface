#!/bin/bash
set -euo pipefail
# Explicit opt-in after operator has verified bus 1 / PCT2075 0x37 / TSL2591 0x29.
[[ $(id -u) == 0 ]] || { echo 'Run with sudo on the Pi after wiring verification.' >&2; exit 1; }
[[ -c /dev/i2c-1 && -f /etc/systemd/system/daw-one.service ]] || { echo 'I2C bus 1 and installed TuneBox service required; no boot configuration is changed.' >&2; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
apt-get update
apt-get install -y python3-venv
python3 -m venv /opt/daw-one-sensor-env
/opt/daw-one-sensor-env/bin/pip install smbus2 adafruit-extended-bus adafruit-circuitpython-tsl2591 'gpiod>=2.2.2,<3'
getent group dawsensors >/dev/null || groupadd --system dawsensors
id dawsensor >/dev/null 2>&1 || useradd --system --gid dawsensors --no-create-home --shell /usr/sbin/nologin dawsensor
usermod -aG i2c dawsensor
install -m 644 "$repo/deploy/sensors/read.py" /opt/daw-one/read-sensors.py
install -m 644 "$repo/deploy/sensors/daw-one-sensors.service" /etc/systemd/system/
install -d /etc/systemd/system/daw-one.service.d
cat > /etc/systemd/system/daw-one.service.d/sensors.conf <<'CONF'
[Service]
SupplementaryGroups=dawsensors
Environment=DAW_SENSOR_FILE=/run/daw-one-sensors/readings.json
CONF
systemctl daemon-reload
systemctl enable --now daw-one-sensors.service
systemctl restart daw-one.service
echo 'Sensor telemetry enabled. Check /api/state hardwareTelemetry; amplifier verification is unchanged.'
