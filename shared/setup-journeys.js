export const setupJourneys=Object.freeze([
  {id:'network',title:'Wi-Fi & network',icon:'wifi',group:'connections'},
  {id:'bluetooth',title:'Bluetooth',icon:'bluetooth',group:'connections'},
  {id:'music',title:'Music Assistant',icon:'rooms',group:'connections'},
  {id:'sound',title:'Sound & DSP',icon:'speaker',group:'audio'},
  {id:'sync',title:'Picture & meter sync',icon:'clock',group:'audio'},
]);
/** Connectivity and music sources are independent, not mutually exclusive. */
export function setupConnectionStatus(snapshot={},network={}){
  const interfaces=Array.isArray(network.interfaces)?network.interfaces:[];
  return {
    network:network.connected===true||interfaces.some(i=>['wifi','ethernet'].includes(i.type)&&i.state==='connected'),
    ethernet:interfaces.some(i=>i.type==='ethernet'&&i.state==='connected'),
    bluetooth:snapshot.bluetooth?.supported===true,
    bluetoothConnected:snapshot.bluetooth?.active===true&&snapshot.bluetooth?.devices?.some(d=>d.connected===true)===true,
    music:snapshot.mode==='music-assistant'&&snapshot.musicAssistant?.connected===true&&snapshot.playback?.connected===true,
    automaticSound:snapshot.automaticDsp?.settings?.enabled===true,
    sync:snapshot.sync?.active?.valid===true,
  };
}
