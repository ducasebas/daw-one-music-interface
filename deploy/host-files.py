#!/usr/bin/env python3
"""Publish host helpers without truncating the live copy. No hardware writes."""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import time


MAX_BYTES = 64 * 1024 * 1024


def read_file(path):
    path = Path(path)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= MAX_BYTES:
        raise ValueError(f'Expected a nonempty regular file: {path}')
    with path.open('rb') as stream:
        data = stream.read(MAX_BYTES + 1)
    if not data or len(data) > MAX_BYTES:
        raise ValueError(f'Invalid file size: {path}')
    return data


def digest(data):
    return hashlib.sha256(data).hexdigest()


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def directory(path):
    path = Path(os.path.abspath(path))
    # Refuse symlinks in host destinations rather than following them as root.
    for parent in [*reversed(path.parents), path]:
        if not parent.exists() and not parent.is_symlink():
            parent.mkdir(mode=0o755)
            sync_directory(parent.parent)
        if not stat.S_ISDIR(parent.lstat().st_mode):
            raise ValueError(f'Expected a real directory: {parent}')


def destination(path):
    path = Path(os.path.abspath(path))
    if any(c in str(path) for c in '\n\r\\'):
        raise ValueError('Unsupported host filename')
    directory(path.parent)
    try:
        info = path.lstat()
    except FileNotFoundError:
        return path
    if not stat.S_ISREG(info.st_mode):
        raise ValueError(f'Refusing a link or special destination: {path}')
    return path


def prepare(path, data, mode):
    """Flush and verify a same-filesystem temporary file before any replacement."""
    fd, name = tempfile.mkstemp(prefix='.' + path.name + '-install-', dir=path.parent)
    temp = Path(name)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            os.fchmod(stream.fileno(), mode)
            stream.flush()
            os.fsync(stream.fileno())
        if digest(read_file(temp)) != digest(data):
            raise ValueError(f'Staged file checksum mismatch: {path}')
        return temp
    except BaseException:
        temp.unlink(missing_ok=True)
        raise


def publish(entries):
    """Validate/stage the entire batch first; each replacement is atomic, not the batch."""
    staged = []
    try:
        for path, data, mode in entries:
            path = destination(path)
            if not data or mode not in (0o600, 0o644, 0o755):
                raise ValueError(f'Invalid host file: {path}')
            if path.exists() and path.stat().st_mode & 0o777 == mode and path.read_bytes() == data:
                continue
            staged.append((path, prepare(path, data, mode), digest(data)))
        # A disk-full/short-write failure during staging cannot touch a live file.
        for path, temp, expected in staged:
            if digest(read_file(temp)) != expected:
                raise ValueError(f'Staged file checksum mismatch: {path}')
        for path, temp, expected in staged:
            destination(path)
            os.replace(temp, path)
            sync_directory(path.parent)
            if digest(read_file(path)) != expected:
                raise ValueError(f'Installed file checksum mismatch: {path}')
    finally:
        for _, temp, _ in staged:
            temp.unlink(missing_ok=True)


def display_program(data):
    """An empty or valid-but-truncated Python script must never pass as a daemon."""
    tree = ast.parse(data, filename='control.py')
    compile(tree, 'control.py', 'exec')
    names = {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}
    mains = [node for node in tree.body if isinstance(node, ast.If)
             and isinstance(node.test, ast.Compare)
             and isinstance(node.test.left, ast.Name) and node.test.left.id == '__name__'
             and any(isinstance(value, ast.Constant) and value.value == '__main__'
                     for value in node.test.comparators)]
    if not {'loop', 'set_level', 'write_status'} <= names or not any(
            isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'loop'
            for main in mains for node in ast.walk(main)):
        raise ValueError('Display controller has no complete daemon entry point')


def install_tree(source, target, inventory, display=False):
    source, target = Path(source), Path(os.path.abspath(target))
    if not source.is_dir() or source.is_symlink() or Path(inventory).name != inventory:
        raise ValueError('Invalid host staging tree or inventory name')
    entries = []
    for path in sorted(source.rglob('*')):
        info = path.lstat()
        if stat.S_ISDIR(info.st_mode):
            continue
        data = read_file(path)
        if path.suffix == '.py':
            compile(data, str(path), 'exec')
        mode = 0o755 if info.st_mode & 0o111 else 0o644
        entries.append((target / path.relative_to(source), data, mode))
    if not entries or any(path == target/inventory for path, _, _ in entries):
        raise ValueError('Empty host staging tree or conflicting inventory')
    if display:
        display_program(read_file(source/'control.py'))
    checksums = ''.join(f'{digest(data)}  {path}\n' for path, data, _ in entries).encode()
    # Commit the expected inventory last. A partial batch cannot pass its startup check.
    publish([*entries, (target/inventory, checksums, 0o644)])
    for path, data, _ in entries:
        if digest(read_file(path)) != digest(data):
            raise ValueError(f'Installed file checksum mismatch: {path}')
    return len(entries)


def wait_display(status='/run/daw-one-display/status.json', timeout=8):
    deadline, previous, last_error = time.monotonic() + timeout, None, 'no fresh controller status'
    while time.monotonic() < deadline:
        try:
            pid = int(subprocess.check_output(
                ['systemctl', '--no-pager', 'show', 'daw-one-display.service', '-p', 'MainPID', '--value'],
                text=True, timeout=1).strip())
            subprocess.run(['systemctl', 'is-active', '--quiet', 'daw-one-display.service'],
                           check=True, timeout=1, capture_output=True)
            path = Path(status)
            if path.stat().st_size > 8192:
                raise ValueError('Oversized controller status')
            value = json.loads(path.read_text())
            if not isinstance(value, dict):
                raise ValueError('Invalid controller status')
            observed = value.get('observedAt', 0)
            if pid > 0 and value.get('pid') == pid and value.get('supported') is True and -1000 <= time.time()*1000 - observed <= 2000:
                if previous and previous[0] == pid and observed > previous[1]:
                    return
                previous = (pid, observed)
            else:
                previous = None
                last_error = 'controller stopped, stale status or backlight unavailable'
        except (OSError, ValueError, TypeError, subprocess.SubprocessError) as error:
            previous, last_error = None, str(error)
        time.sleep(.25)
    raise RuntimeError('Display service did not produce live backlight status: ' + last_error)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    file = commands.add_parser('file')
    file.add_argument('source'); file.add_argument('target')
    file.add_argument('--mode', choices=['600', '644', '755'], default='644')
    tree = commands.add_parser('tree')
    tree.add_argument('source'); tree.add_argument('target'); tree.add_argument('--inventory', required=True)
    tree.add_argument('--display', action='store_true')
    commands.add_parser('wait-display')
    args = parser.parse_args()
    if args.command == 'file':
        publish([(Path(args.target), read_file(args.source), int(args.mode, 8))])
    elif args.command == 'tree':
        count = install_tree(args.source, args.target, args.inventory, args.display)
        print(f'Installed and verified {count} host files.', flush=True)
    else:
        wait_display()
        print('Display controller running with fresh backlight status.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, SyntaxError, subprocess.SubprocessError) as error:
        print('Host file check failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
