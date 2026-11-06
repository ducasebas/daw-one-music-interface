# Real PCT2075 / TSL2591 telemetry (opt-in)

Owner bench evidence: PCT2075 at I²C bus 1/address **0x37** returned **19.500 °C**, and TSL2591 at **0x29** returned **485.74848 lux**. Response to finger/light changes was confirmed. These are local sensor observations, not calibration or thermal-protection certification. Do not treat PCT temperature as Pi CPU temperature.

The normal installer still defaults to simulated hardware and does not enable I²C, change wiring/boot overlays, install sensor drivers or grant the backend device access. First verify the exact Adafruit breakouts, 3.3 V chain and both addresses with the Pi safely powered off during wiring changes. Existing manual `board.I2C()` diagnostics needed gpiod; the packaged reader uses an explicit bus-1 ExtendedI2C route and includes the missing dependency in its separate environment.

## Install after the normal app update

From the **fresh extracted release directory** on the Pi (the folder containing `deploy/`, not `/opt/daw-one`):

```sh
sudo bash deploy/install-sensors.sh
```

This explicitly installs a dedicated Python environment and sensor unit, creates a restricted sensor account and a backend drop-in, enables the sensor service and restarts only the TuneBox backend. It does not restart Squeezelite or rewire/configure the HAT. No pip installs are made into the system Python or your existing home virtualenv. The service gets I²C bus 1 access; Node retains PrivateDevices and reads only the shared runtime JSON through a dedicated sensors group. Do not use the token-owning `dawone` group for the sensor process.

The reader polls both sensors approximately every three seconds, reading the PCT temperature register and initializing/reading the TSL2591 through its supported driver. TSL2591 initialization configures/enables that sensor; no GPIO/amplifier/backlight writes occur. A failing sensor does not fabricate the other sensor's reading. The service atomically replaces `/run/daw-one-sensors/readings.json`; the backend validates schema, units, ranges and timestamp and marks values older than 15 seconds stale. Missing files and errors become unavailable/null, never zero.

```sh
sudo systemctl status daw-one-sensors.service --no-pager -l
sudo journalctl -u daw-one-sensors.service -b --no-pager -n 40
curl -fsS http://127.0.0.1:3001/api/state |
node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.stringify(JSON.parse(s).hardwareTelemetry,null,2)))'
```

In the interface, open **Opstartcontrole** to see the separate real PCT2075/lux readings. The simulated temperature/light controls and CPU boot check remain separately labelled. A stale/saturated/unavailable reading is unknown. These values do not grant amplifier verification, change the simulated safety state, regulate a fan or physically dim the screen. Automatic brightness and verified physical thermal protection are separate future integrations.

## Disable / recover

```sh
sudo systemctl disable --now daw-one-sensors.service
```

Values become stale/unavailable automatically. To remove the opt-in backend configuration, remove only `/etc/systemd/system/daw-one.service.d/sensors.conf`, then `sudo systemctl daemon-reload` and `sudo systemctl restart daw-one.service`. Keep the state/config/MA token files intact. If I²C is busy or a kernel driver already owns a device, resolve ownership before trying to bypass it; do not use force-address options.

Software tests use fixtures; the packaged systemd account/permissions, current Python dependency versions and actual readings still require the owner's installation check on the Pi. Sensor detection does not validate the power, amplifier, display or independent fail-safe design.

In a development checkout, test commands: `npm run check`, `python3 -m unittest discover -s tests -p sensor_reader_test.py`, and the browser sensor/boot journeys. The separate sensor service itself still needs installation verification on the actual Pi; a successful former manual root read does not prove the service account permissions.
