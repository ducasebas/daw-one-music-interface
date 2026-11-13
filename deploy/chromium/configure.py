#!/usr/bin/env python3
"""Managed Chromium policy for the dedicated Pi appliance, never a personal profile."""
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

POLICY = Path('/etc/chromium/policies/managed/daw-one-appliance.json')

def policy_for_major(major):
    if not isinstance(major, int) or isinstance(major, bool) or major < 103:
        raise ValueError('Chromium 103 or newer is required for the managed appliance profile')
    policy = {
        'TranslateEnabled': False,
        'PasswordManagerEnabled': False,
        'BrowserSignin': 0,
        'SyncDisabled': True,
        'BrowserAddPersonEnabled': False,
        'BrowserGuestModeEnabled': False,
        'IncognitoModeAvailability': 1,
        'DefaultBrowserSettingEnabled': False,
        'DefaultNotificationsSetting': 2,
        'DefaultGeolocationSetting': 2,
        'DefaultClipboardSetting': 2,
        'DefaultSensorsSetting': 2,
        'DefaultPopupsSetting': 2,
        'DefaultFileSystemReadGuardSetting': 2,
        'DefaultFileSystemWriteGuardSetting': 2,
        'DefaultSerialGuardSetting': 2,
        'DefaultWebBluetoothGuardSetting': 2,
        'DefaultWebHidGuardSetting': 2,
        'DefaultWebUsbGuardSetting': 2,
        'AudioCaptureAllowed': False,
        'VideoCaptureAllowed': False,
        'AllowFileSelectionDialogs': False,
        'PrintingEnabled': False,
        'DownloadRestrictions': 3,
        'DeveloperToolsAvailability': 2,
        'SpellcheckEnabled': False,
        'SearchSuggestEnabled': False,
        'BlockExternalExtensions': True,
        'ExtensionInstallBlocklist': ['*'],
    }
    if major >= 154:
        policy['AutofillSettings'] = [{'url_pattern': '*', 'blocked_types': ['all']}]
    else:
        policy.update(AutofillAddressEnabled=False, AutofillCreditCardEnabled=False)
    if major >= 128:
        policy['PromotionsEnabled'] = False
    else:
        policy['PromotionalTabsEnabled'] = False
    if major >= 132:
        policy['PasswordManagerPasskeysEnabled'] = False
    if major >= 138:
        policy['PasswordManagerBlocklist'] = ['*']
    # Unset RelaunchNotification: values 1/2 explicitly enable recurring warnings.
    # Security updates remain the package manager's responsibility.
    return policy

def install_policy(policy, path=POLICY):
    """Preserve other administrators' files and reject contradictory settings."""
    missing, directory = [], path.parent
    while not directory.exists():
        missing.append(directory)
        directory = directory.parent
    for directory in reversed(missing):
        directory.mkdir(mode=0o755)
        directory.chmod(0o755)
    for other in path.parent.glob('*.json'):
        if other == path:
            continue
        existing = json.loads(other.read_text())
        if not isinstance(existing, dict):
            raise ValueError('Invalid managed policy file: ' + other.name)
        conflicts = sorted(k for k in policy if k in existing and existing[k] != policy[k])
        if conflicts:
            raise ValueError('Conflicting Chromium policy in ' + other.name + ': ' + ', '.join(conflicts))
    raw = json.dumps(policy, indent=2, sort_keys=True) + '\n'
    if path.exists() and path.read_text() == raw:
        return False
    if path.exists():
        shutil.copy2(path, str(path) + '.before-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False) as file:
        file.write(raw)
        temporary = Path(file.name)
    temporary.chmod(0o644)
    temporary.replace(path)
    return True

def browser_major():
    result = subprocess.run(['/usr/bin/chromium', '--version'], check=True, capture_output=True, text=True, timeout=10)
    found = re.search(r'Chromium\s+(\d+)\.', result.stdout)
    if not found:
        raise ValueError('Cannot determine the installed Chromium version')
    return int(found.group(1))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--print', action='store_true')
    args = parser.parse_args()
    major = browser_major()
    policy = policy_for_major(major)
    if args.print:
        print(json.dumps(policy, indent=2, sort_keys=True))
    else:
        if os.geteuid() != 0:
            raise SystemExit('Run the device installer with sudo')
        changed = install_policy(policy)
        print('Chromium appliance policy ' + ('installed' if changed else 'already current') + '; browser major ' + str(major))
