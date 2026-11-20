#!/usr/bin/python3
"""A2DP-only numeric comparison with an explicit, expiring on-device confirmation."""
import json
import os
from pathlib import Path
import secrets
import socket
import time
from approved import load as approved_load, save as approved_save

ROOT = Path('/run/daw-one-bluetooth')
AUDIO_SERVICES = {'0000110a', '0000110b', '0000110c', '0000110e', '0000110f'}

def read(name):
    try:
        raw = (ROOT / name).read_text()
        return json.loads(raw) if len(raw) <= 32768 else {}
    except (OSError, ValueError):
        return {}

def write(name, value):
    path = ROOT / (name + '.tmp')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o640)
    with os.fdopen(fd, 'w') as output:
        json.dump(value, output)
    path.replace(ROOT / name)

def transport_info(objects, device_path):
    """The phone's active A2DP link as BlueZ reports it: codec id and its configuration bytes (no estimate)."""
    for key, value in objects.items():
        data = value.get('org.bluez.MediaTransport1')
        if data and str(key).startswith(str(device_path) + '/'):
            return {'codec': int(data.get('Codec', -1)), 'configuration': [int(b) for b in list(data.get('Configuration', []))[:16]], 'state': str(data.get('State', ''))[:16]}
    return None


class LinkHistory:
    """Connection stability per phone: how long the current link has held and how often it dropped in the last hour."""
    def __init__(self):
        self.since = {}
        self.drops = {}

    def update(self, address, connected, now):
        if connected:
            self.since.setdefault(address, now)
        elif address in self.since:
            del self.since[address]
            self.drops.setdefault(address, []).append(now)
        self.drops[address] = [t for t in self.drops.get(address, []) if now - t < 3600][-20:]
        return {'connectedSeconds': int(now - self.since[address]) if address in self.since else 0, 'dropsLastHour': len(self.drops[address])}


def pairing_open(window, boot_id, seconds):
    expiry = window.get('expiresBootSeconds')
    return window.get('bootId') == boot_id and isinstance(expiry, (float, int)) and 0 < expiry - seconds <= 120

def clean(value):
    return ''.join(c for c in str(value) if ord(c) >= 32 and ord(c) != 127)[:160]

HISTORY = LinkHistory()


def main():
    import dbus
    import dbus.service
    from dbus.mainloop.glib import DBusGMainLoop
    from gi.repository import GLib
    DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()
    loop = GLib.MainLoop()
    boot_id = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    def seconds():
        return time.clock_gettime(time.CLOCK_BOOTTIME)
    def properties(path):
        return dbus.Interface(bus.get_object('org.bluez', path), 'org.freedesktop.DBus.Properties')
    def active():
        return read('source.json').get('active') is True
    def trusted(path):
        data = properties(path).GetAll('org.bluez.Device1', timeout=3)
        return active() and data.get('Paired') and not data.get('Trusted') and str(data.get('Address')) in approved_load()
    def rejected():
        return dbus.exceptions.DBusException('Confirm pairing on TuneBox', name='org.bluez.Error.Rejected')

    class Agent(dbus.service.Object):
        pending = None

        def cancel_pending(self):
            if self.pending:
                _, _, error, _ = self.pending
                self.pending = None
                error(rejected())
            write('pairing.json', {})

        @dbus.service.method('org.bluez.Agent1', in_signature='', out_signature='')
        def Release(self):
            self.cancel_pending()
            loop.quit()

        @dbus.service.method('org.bluez.Agent1', in_signature='', out_signature='')
        def Cancel(self):
            self.cancel_pending()

        @dbus.service.method('org.bluez.Agent1', in_signature='ou', out_signature='', async_callbacks=('reply', 'error'))
        def RequestConfirmation(self, device, passkey, reply, error):
            if not active() or not pairing_open(read('window.json'), boot_id, seconds()) or self.pending:
                error(rejected())
                return
            nonce = secrets.token_hex(16)
            data = properties(device).GetAll('org.bluez.Device1', timeout=3)
            self.pending = (nonce, reply, error, (device, seconds() + 30))
            write('pairing.json', {'nonce': nonce, 'name': clean(data.get('Alias', 'Phone')), 'code': f'{int(passkey):06d}', 'expiresAt': int((time.time() + 30) * 1000)})

        @dbus.service.method('org.bluez.Agent1', in_signature='os', out_signature='')
        def AuthorizeService(self, device, uuid):
            if str(uuid).lower()[:8] not in AUDIO_SERVICES or not trusted(device):
                raise rejected()

        @dbus.service.method('org.bluez.Agent1', in_signature='o', out_signature='')
        def RequestAuthorization(self, device):
            if not trusted(device):
                raise rejected()

        @dbus.service.method('org.bluez.Agent1', in_signature='o', out_signature='s')
        def RequestPinCode(self, device):
            raise rejected()

        @dbus.service.method('org.bluez.Agent1', in_signature='o', out_signature='u')
        def RequestPasskey(self, device):
            raise rejected()

        @dbus.service.method('org.bluez.Agent1', in_signature='os', out_signature='')
        def DisplayPinCode(self, device, pincode):
            raise rejected()

        @dbus.service.method('org.bluez.Agent1', in_signature='ouq', out_signature='')
        def DisplayPasskey(self, device, passkey, entered):
            raise rejected()

        def tick(self):
            if self.pending:
                nonce, reply, error, (device, expiry) = self.pending
                decision = read('decision.json')
                if not active() or seconds() > expiry or not pairing_open(read('window.json'), boot_id, seconds()):
                    self.cancel_pending()
                elif decision.get('nonce') == nonce:
                    self.pending = None
                    write('pairing.json', {})
                    if decision.get('accept') is True:
                        try:
                            data = properties(device).GetAll('org.bluez.Device1', timeout=3)
                            approved_save([*approved_load(), str(data.get('Address'))])
                            properties(device).Set('org.bluez.Device1', 'Trusted', dbus.Boolean(False), timeout=3)
                            reply()
                        except Exception:
                            error(rejected())
                    else:
                        error(rejected())
            try:
                objects = dbus.Interface(bus.get_object('org.bluez', '/'), 'org.freedesktop.DBus.ObjectManager').GetManagedObjects(timeout=3)
                adapters = [v['org.bluez.Adapter1'] for v in objects.values() if 'org.bluez.Adapter1' in v]
                devices = []
                approved = approved_load()
                forget = read('forget.json').get('address')
                if forget in approved:
                    approved = [v for v in approved if v != forget]
                    approved_save(approved)
                (ROOT / 'forget.json').unlink(missing_ok=True)
                now = seconds()
                for path, value in list(objects.items())[:256]:
                    data = value.get('org.bluez.Device1')
                    if not data or str(data.get('Address')) not in approved or not data.get('Paired'):
                        continue
                    players = [p['org.bluez.MediaPlayer1'] for key, p in objects.items() if str(key).startswith(str(path) + '/') and 'org.bluez.MediaPlayer1' in p]
                    track = players[0].get('Track', {}) if players else {}
                    devices.append({'address': str(data.get('Address', '')), 'name': clean(data.get('Alias', 'Phone')), 'connected': bool(data.get('Connected')), 'paired': bool(data.get('Paired')), 'title': clean(track.get('Title', '')), 'artist': clean(track.get('Artist', '')), 'link': HISTORY.update(str(data.get('Address', '')), bool(data.get('Connected')), now), 'transport': transport_info(objects, path)})
                write('audio-phones.json', [d['address'] for d in devices])
                write('telemetry.json', {'available': any(a.get('Powered') for a in adapters), 'discoverable': any(a.get('Discoverable') for a in adapters), 'devices': devices[:16], 'observedAt': int(time.time() * 1000)})
            except Exception:
                write('audio-phones.json', [])
                write('telemetry.json', {'available': False, 'observedAt': int(time.time() * 1000)})
            return True

    agent = Agent(bus, '/org/dutchaudioworks/TuneBoxAgent')
    manager = dbus.Interface(bus.get_object('org.bluez', '/org/bluez'), 'org.bluez.AgentManager1')
    manager.RegisterAgent('/org/dutchaudioworks/TuneBoxAgent', 'DisplayYesNo', timeout=5)
    manager.RequestDefaultAgent('/org/dutchaudioworks/TuneBoxAgent', timeout=5)
    write('pairing.json', {})
    write('audio-phones.json', [])
    notify = os.environ.get('NOTIFY_SOCKET')
    if notify:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as ready:
            ready.connect('\0' + notify[1:] if notify.startswith('@') else notify)
            ready.sendall(b'READY=1')
    GLib.timeout_add(1000, agent.tick)
    try:
        loop.run()
    finally:
        agent.cancel_pending()

if __name__ == '__main__':
    main()
