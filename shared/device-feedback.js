/** User actions get visible feedback; background status polling stays quiet. */
const quiet=new Set(['status','power-status','network','clock','dsp','measurement-status','sync-status','dsp-auto-status','local-ma-status','bluetooth-status']);
const messages={
 'power-config':'Saving power settings…','power-discover-20v':'Checking the power adapter…',
 'power-request-100w':'Applying and checking power settings…','power-request-20v':'Applying and checking power settings…','power-request-max20v':'Applying and checking power settings…',
 'wifi-scan':'Looking for Wi-Fi networks…',wifi:'Connecting to Wi-Fi…','hotspot-start':'Starting temporary Wi-Fi…','hotspot-stop':'Stopping temporary Wi-Fi…',
 'probe-music':'Checking the music server…','save-music':'Saving the music connection…',
 'dsp-initialize':'Preparing audio…','dsp-set':'Applying sound settings…','dsp-auto-config':'Applying sound settings…',
 'sync-start':'Starting the timing measurement…','sync-stop':'Stopping the timing measurement…',
 'measurement-start':'Starting the room measurement…','measurement-stop':'Stopping the room measurement…','measurement-apply':'Applying room correction…','measurement-undo':'Restoring sound settings…',
 'local-ma-install':'Starting the music server installation…','clock-set':'Setting the clock…',policy:'Saving update settings…',check:'Checking for updates…',install:'Preparing the update…',rollback:'Restoring the previous version…',
 'bluetooth-start':'Starting Bluetooth…','bluetooth-stop':'Stopping Bluetooth audio…','bluetooth-pair':'Pairing your device…','bluetooth-remove':'Removing the paired device…','bluetooth-confirm':'Confirming the Bluetooth connection…',
 'local-standby':'Changing standby…','power-off':'Shutting down TuneBox…',reboot:'Restarting TuneBox…','restart-service':'Restarting the TuneBox service…','complete-setup':'Finishing setup…','audio-test':'Preparing the audio test…','erase-setup':'Restoring setup settings…',
};
export const deviceActionMessage=command=>quiet.has(command)?null:messages[command]||'Working…';
