#!/usr/bin/env python3
"""Read-only HSP24/LD2410 telemetry. Frame format checked against Seeed's HSP24 reference; no vendor implementation is bundled."""
import argparse,json,os,time
from pathlib import Path
HEADER=b'\xf4\xf3\xf2\xf1';FOOTER=b'\xf8\xf7\xf6\xf5'
class Frames:
    def __init__(self):self.buffer=b''
    def push(self,chunk):
        self.buffer=(self.buffer+chunk)[-4096:];result=None
        while len(self.buffer)>=6:
            start=self.buffer.find(HEADER)
            if start<0:self.buffer=self.buffer[-3:];break
            self.buffer=self.buffer[start:]
            if len(self.buffer)<6:break
            size=int.from_bytes(self.buffer[4:6],'little')
            if size<13 or size>128:self.buffer=self.buffer[4:];continue
            end=6+size
            if len(self.buffer)<end+4:break
            body=self.buffer[6:end];valid=self.buffer[end:end+4]==FOOTER and body[0] in (1,2) and body[1]==0xaa and body[2] in (0,1,2,3) and body[-2:]==b'\x55\x00'
            self.buffer=self.buffer[end+4:]
            if not valid:continue
            distance=int.from_bytes(body[9:11],'little')/100
            energy=max(body[5],body[8])
            if distance<=10 and energy<=100:result={'schema':1,'observedAt':int(time.time()*1000),'present':body[2]!=0,'distance':distance,'energy':energy,'source':'Seeed HSP24 UART','simulated':False}
        return result

def main():
    import serial
    p=argparse.ArgumentParser();p.add_argument('--device',required=True);p.add_argument('--baud',type=int,default=256000);args=p.parse_args()
    state=Path('/run/daw-one-presence/readings.json');frames=Frames()
    with serial.Serial(args.device,args.baud,timeout=1,exclusive=True) as port:
        while True:
            value=frames.push(port.read(256))
            if value:
                temp=state.with_suffix('.tmp');temp.write_text(json.dumps(value)+'\n');temp.chmod(0o644);temp.replace(state)
if __name__=='__main__':main()
