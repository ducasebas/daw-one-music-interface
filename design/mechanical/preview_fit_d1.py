#!/usr/bin/env python3
"""Render a technical open-back preview from local vendor CAD + labelled proxies.

No image-generation geometry is used. This is a model illustration, not a
photograph, a manufactured unit, or additional evidence of physical fit.
"""
import argparse,json,struct
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import cadquery as cq
from fit_d1 import OUT, W,H,D,GX,GY,COLOURS


def cube(b):
    x0,x1,y0,y1,z0,z1=b
    p=np.array([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
                [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]])
    return [p[v] for v in [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]]


def stl(path):
    b=path.read_bytes()
    n=struct.unpack_from('<I',b,80)[0]
    if len(b)==84+50*n:
        dt=np.dtype([('normal','<f4',(3,)),('vertices','<f4',(3,3)),('attribute','<u2')])
        return np.frombuffer(b,dtype=dt,offset=84,count=n)['vertices'].copy()
    nums=[]
    for line in b.decode().splitlines():
        if line.strip().startswith('vertex '):nums.append([float(x) for x in line.split()[1:]])
    return np.asarray(nums).reshape(-1,3,3)


def mesh(shape):
    vertices,triangles=shape.tessellate(.4,.45)
    v=np.asarray([x.toTuple() for x in vertices])
    return v[np.asarray(triangles)]


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--sources',type=Path,required=True)
    a=ap.parse_args();parts=json.loads((OUT/'fit-d1-parts.json').read_text())
    fig=plt.figure(figsize=(15,9.4),facecolor='#f8f8f5')
    ax=fig.add_subplot(111,projection='3d',facecolor='#f8f8f5')
    # Core is translucent to make the internal layout visible; finish is not rendered.
    ax.add_collection3d(Poly3DCollection(stl(OUT/'fit-d1-core.stl'),
        facecolor='#9a7651',edgecolor='none',alpha=.16,rasterized=True))
    positions={
      'screen':lambda s:s.rotate((0,0,0),(1,1,0),180).translate((85.09+GX,52.1+GY,4.6)),
      'hat':lambda s:s.rotate((0,0,0),(0,1,0),180).translate((101.775,51.435,34.5)),
      'pd':lambda s:s.rotate((0,0,0),(1,0,0),180).translate((148,28.4271,35)),
      'ina':lambda s:s.rotate((0,0,0),(1,1,0),180).translate((142,35,35)),
      'button':lambda s:s.rotate((0,0,0),(1,0,0),-90).translate((88,H,28))}
    for name,fn in positions.items():
        print('Tessellating',name,flush=True)
        raw=cq.importers.importStep(str(a.sources/(name+'.step'))).val()
        for i,solid in enumerate(raw.Solids()):
            s=fn(solid)
            if name=='screen':
                colour='#1b252a' if i in [0,1] else ('#337bad' if i==3 else '#bdc6c8')
                alpha=.25 if i in [0,1] else .85
            elif name=='hat':colour='#387561' if i==0 else '#646c6a';alpha=.92
            elif name=='button':colour='#bb904d';alpha=1
            else:colour=COLOURS[name] if i==0 else '#aeb8b7';alpha=.95
            faces=mesh(s)
            if len(faces):ax.add_collection3d(Poly3DCollection(faces,facecolor=colour,edgecolor='none',alpha=alpha,rasterized=True))
    for name,p in parts.items():
        if name in positions or name in ['core','veneer','rear','routing_layer'] or '_qt_' in name:
            continue
        b=p['bbox'];colour=COLOURS.get(name,'#607f88')
        ax.add_collection3d(Poly3DCollection(cube(b),facecolor=colour,
            edgecolor=colour,linewidth=.45,alpha=.1 if name=='pi' else .25))
    labels=[('Pi-ruimte',30,55,42),('Louder HAT',100,45,38),
            ('USB-C PD',158,14,38),('INA228',153,48,38),('TSR / ULN',153,82,40),
            ('Temperatuur',120,103,29),('Licht',150,103,41),('Topknop',88,112,30)]
    for text,x,y,z in labels:ax.text(x,y,z,text,fontsize=8,color='#203c45',ha='center')
    ax.set(xlim=(-4,W+4),ylim=(-5,H+8),zlim=(-2,D+4),
           xlabel='breedte (mm)',ylabel='hoogte (mm)',zlabel='diepte (mm)')
    ax.set_box_aspect((W,H,D))
    ax.view_init(elev=38,azim=-66)
    ax.set_proj_type('ortho')
    ax.set_xticks([0,50,100,150,176]);ax.set_yticks([0,50,110]);ax.set_zticks([0,15.3,45])
    ax.tick_params(labelsize=8)
    fig.suptitle('TuneBox D1 — open achteraanzicht van het pasmodel',x=.05,y=.96,ha='left',fontsize=18,color='#263b42',fontweight='bold')
    fig.text(.05,.91,'176 × 110 × 45 mm · achterplaat verborgen · houtkern transparant · fabrikant-CAD en expliciete reserveringen',fontsize=10,color='#52676e')
    fig.text(.05,.045,'Werkelijke STEP-geometrie: Waveshare, Sonocotta en Adafruit. Pi, carrier, kabelpluggen en losse aansluitdelen zijn reserveringen.',fontsize=9,color='#52676e')
    fig.text(.05,.025,'Technische modelillustratie; bevestiging, volledige kabelroute, warmte en RF zijn nog niet op het complete apparaat gevalideerd.',fontsize=9,color='#52676e')
    fig.subplots_adjust(left=0,right=.95,bottom=.08,top=.88)
    fig.savefig(OUT/'fit-d1-cad-preview.png',dpi=150)
    print('Saved',OUT/'fit-d1-cad-preview.png',flush=True)


if __name__=='__main__':main()
