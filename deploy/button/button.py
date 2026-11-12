#!/usr/bin/env python3
"""Debounced physical button: short on release, long once at three seconds."""
import argparse,json,secrets,time,urllib.request,grp,os
from pathlib import Path
class Button:
    def __init__(self):self.pressed=None;self.long_sent=False
    def edge(self,down,now):
        if down and self.pressed is None:self.pressed=now;self.long_sent=False
        elif not down and self.pressed is not None:
            elapsed=now-self.pressed;self.pressed=None
            if not self.long_sent and elapsed>=.05:return 'long' if elapsed>=3 else 'short'
        return None
    def tick(self,now):
        if self.pressed is not None and not self.long_sent and now-self.pressed>=3:self.long_sent=True;return 'long'
        return None

def main():
    import gpiod
    from datetime import timedelta
    p=argparse.ArgumentParser();p.add_argument('--gpio',required=True,type=int);args=p.parse_args()
    if args.gpio not in (5,6,16,17,22,23,24,25,26,27):raise SystemExit('Select a verified free GPIO; I2C/I2S/reset pins are blocked')
    path=Path('/run/daw-one-button/token');token=secrets.token_hex(32);path.write_text(token);os.chown(path,0,grp.getgrnam('dawone').gr_gid);path.chmod(0o640)
    def send(kind):
        request=urllib.request.Request('http://127.0.0.1:3001/api/button',data=json.dumps({'type':kind}).encode(),headers={'Content-Type':'application/json','X-TuneBox-Button':token})
        try:
            with urllib.request.urlopen(request,timeout=8) as r:r.read(1024)
        except Exception as e:print('Button request not confirmed:',type(e).__name__,flush=True)
    config=gpiod.LineSettings(direction=gpiod.line.Direction.INPUT,edge_detection=gpiod.line.Edge.BOTH,bias=gpiod.line.Bias.PULL_UP,debounce_period=timedelta(milliseconds=40));button=Button()
    with gpiod.request_lines('/dev/gpiochip0',consumer='tunebox-button',config={args.gpio:config}) as lines:
        while True:
            if lines.wait_edge_events(timeout=timedelta(milliseconds=50)):
                for event in lines.read_edge_events():
                    kind=button.edge(event.event_type==gpiod.EdgeEvent.Type.FALLING_EDGE,event.timestamp_ns/1e9)
                    if kind:send(kind)
            kind=button.tick(time.monotonic())
            if kind:send(kind)
if __name__=='__main__':main()
