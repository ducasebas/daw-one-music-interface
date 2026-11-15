#!/usr/bin/python3
"""Bounded BlueZ operations. No shell commands or arbitrary D-Bus paths from the GUI."""
import re
import sys
from approved import load as approved_load

def main():
    import dbus
    bus = dbus.SystemBus()
    objects = dbus.Interface(bus.get_object('org.bluez', '/'), 'org.freedesktop.DBus.ObjectManager').GetManagedObjects(timeout=5)
    adapters = sorted(path for path, value in objects.items() if 'org.bluez.Adapter1' in value)
    if not adapters:
        raise RuntimeError('Bluetooth adapter unavailable')
    path = adapters[0]
    props = dbus.Interface(bus.get_object('org.bluez', path), 'org.freedesktop.DBus.Properties')
    action = sys.argv[1]
    def set_property(key, value):
        props.Set('org.bluez.Adapter1', key, value, timeout=5)
    if action == 'ready':
        set_property('Powered', dbus.Boolean(True))
        set_property('Alias', 'TuneBox')
        set_property('Pairable', dbus.Boolean(False))
        set_property('Discoverable', dbus.Boolean(False))
    elif action == 'pair':
        set_property('PairableTimeout', dbus.UInt32(120))
        set_property('DiscoverableTimeout', dbus.UInt32(120))
        set_property('Pairable', dbus.Boolean(True))
        set_property('Discoverable', dbus.Boolean(True))
    elif action == 'close':
        set_property('Pairable', dbus.Boolean(False))
        set_property('Discoverable', dbus.Boolean(False))
    elif action in ('disconnect', 'forget', 'disconnect-all'):
        address = sys.argv[2] if len(sys.argv) == 3 else ''
        if action != 'disconnect-all' and not re.fullmatch(r'(?:[A-F0-9]{2}:){5}[A-F0-9]{2}', address):
            raise ValueError('Invalid device address')
        for device, value in list(objects.items())[:256]:
            data = value.get('org.bluez.Device1', {})
            if not str(device).startswith(str(path) + '/') or not data:
                continue
            if action == 'disconnect-all' and str(data.get('Address')) not in approved_load():
                continue
            if action != 'disconnect-all' and data.get('Address') != address:
                continue
            if action == 'forget':
                dbus.Interface(bus.get_object('org.bluez', path), 'org.bluez.Adapter1').RemoveDevice(device, timeout=5)
            elif data.get('Connected'):
                dbus.Interface(bus.get_object('org.bluez', device), 'org.bluez.Device1').Disconnect(timeout=5)
    else:
        raise ValueError('Unsupported Bluetooth action')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Bluetooth adapter operation failed', file=sys.stderr)
        sys.exit(1)
