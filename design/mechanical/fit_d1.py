#!/usr/bin/env python3
"""D1: material-led fit prototype. Vendor CAD is used locally, not redistributed.

Run: python design/mechanical/fit_d1.py --sources /path/to/manufacturer-files
Required STEP files: screen.step, hat.step, pd.step, ina.step, button.step.
PCB files pct.brd / tsl.brd provide component locations. CadQuery, ReportLab,
PyMuPDF and Matplotlib are needed. Collision checks concern nominal CAD and
explicit proxy reservations; this is not a fabricated/thermal-validated product.
"""
from pathlib import Path
import argparse, csv, hashlib, itertools, json, math, sys
from functools import lru_cache
import xml.etree.ElementTree as ET
import cadquery as cq
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_layout import Sheet, OUT, INK, MUTED, GRID

W,H,D = 176.,110.,45.
FINISH=.8                 # allowance: veneer, backing, adhesive, finish
CORE=4.                  # nominal rear wall; front rebate is modelled separately
REAR=3.
GAP=.4                   # nominal display-to-rebate clearance, not mfr tolerance
GX,GY=(W-170.18)/2,(H-104.2)/2
COLOURS={'screen':'#272e33','pi':'#236b8e','hat':'#9b693b','pd':'#86599c',
         'ina':'#86599c','button':'#b38340','pct':'#41836e','tsl':'#41836e',
         'carrier':'#86599c','radar':'#41836e','fuse':'#a64f46','wago1':'#bc7139',
         'wago2':'#bc7139','speaker_l':'#637177','speaker_r':'#637177'}


def box(x,y,z,w,h,d):
    return cq.Solid.makeBox(w,h,d,cq.Vector(x,y,z))


def rounded(x,y,z,w,h,d,r):
    return (cq.Workplane('XY').box(w,h,d,centered=(False,False,False))
            .edges('|Z').fillet(r).translate((x,y,z)).val())


@lru_cache(maxsize=10000)
def bb(s):
    b=s.BoundingBox()
    return [round(getattr(b,k),5) for k in ['xmin','xmax','ymin','ymax','zmin','zmax']]


def overlaps(a,b,eps=1e-5):
    return all(min(a[2*i+1],b[2*i+1])-max(a[2*i],b[2*i])>eps for i in range(3))


def component_sensor(path, connector_solids):
    """PCB + real JST housings; other parts are conservative height proxies."""
    root=ET.parse(path);board=root.find('.//board')
    pcb=box(0,0,0,25.4,17.78,1.57)
    holes=[(2.54,2.54),(22.86,2.54),(2.54,15.24),(22.86,15.24)]
    for x,y in holes:pcb=pcb.cut(cq.Solid.makeCylinder(1.375,1.57,cq.Vector(x,y,0)))
    pieces=[pcb]
    # Same JST_SH4 package, placed according to the sensor Eagle file.
    pieces.extend([connector_solids[0].translate((.381,0,0)),
                   connector_solids[1].translate((-.381,0,0))])
    libraries={(l.get('name'),p.get('name')):p for l in board.find('libraries')
               for p in l.find('packages')}
    for e in board.find('elements'):
        if e.get('package') in ['JST_SH4'] or e.get('library') in ['silks']:
            continue
        pkg=libraries.get((e.get('library'),e.get('package')))
        if pkg is None or 'MOUNTING' in e.get('package',''):continue
        # Only solder-pad extent; exclude silkscreen text / logos.
        coords=[]
        for pad in pkg.findall('smd'):
            if pad.get('layer')!='1':continue
            px,py=float(pad.get('x')),float(pad.get('y'))
            dx,dy=float(pad.get('dx')),float(pad.get('dy'))
            coords.extend([(px-dx/2,py-dy/2),(px+dx/2,py+dy/2)])
        if not coords:continue
        rot=e.get('rot','R0')
        if 'M' in rot:continue
        angle=math.radians(float(rot.replace('R','')))
        ox,oy=float(e.get('x')),float(e.get('y'))
        pts=[(ox+x*math.cos(angle)-y*math.sin(angle),
              oy+x*math.sin(angle)+y*math.cos(angle)) for x,y in coords]
        xmin,xmax=min(p[0] for p in pts)-.2,max(p[0] for p in pts)+.2
        ymin,ymax=min(p[1] for p in pts)-.2,max(p[1] for p in pts)+.2
        # Explicitly a component envelope, not a validated package STEP.
        height=1.9 if e.get('name','').startswith(('U','IC')) else 1.2
        pieces.append(box(xmin,ymin,1.57,xmax-xmin,ymax-ymin,height))
    return cq.Compound.makeCompound(pieces)


def build(sources):
    raw={n:cq.importers.importStep(str(sources/(n+'.step'))).val()
         for n in ['screen','hat','pd','ina','button']}
    parts={}
    def add(name,shape,kind,description,source=None):
        parts[name]={'shape':shape,'kind':kind,'description':description,'source':source}
    screen=raw['screen'].rotate((0,0,0),(1,1,0),180).translate((85.09+GX,52.1+GY,4.6))
    add('screen',screen,'manufacturer CAD','Waveshare 29112, 25 solids', 'screen.step')
    # A conservative unplugged Pi4 / GPIO-reservation envelope, not vendor STEP.
    add('pi',box(6.5,6,19,60,92,22),'conservative envelope',
        'Pi4: 85x56 PCB plus SD/port margins; component side toward rear plate')
    hat=raw['hat'].rotate((0,0,0),(0,1,0),180).translate((101.775,51.435,34.5))
    add('hat',hat,'manufacturer CAD','Louder Plus1X Rev F, mirrored by physical Y rotation','hat.step')
    pd=raw['pd'].rotate((0,0,0),(1,0,0),180).translate((148,28.4271,35))
    add('pd',pd,'manufacturer CAD','Adafruit 5991; USB opening 0.5 mm beyond bottom','pd.step')
    ina=raw['ina'].rotate((0,0,0),(1,1,0),180).translate((142,35,35))
    add('ina',ina,'manufacturer CAD','Adafruit 5832; QT toward top/bottom','ina.step')
    button=raw['button'].rotate((0,0,0),(1,0,0),-90).translate((88,H,28))
    add('button',button,'manufacturer CAD','3350; model differs from product overall size, nut reserve added','button.step')
    add('button_nut',cq.Solid.makeCylinder(11,3,cq.Vector(88,H-7.8,28),cq.Vector(0,1,0)),
        'reservation','22 mm nut reserve; fastener/detail design follows')
    # Small PCBs lie parallel to the top wall, not behind the main PCBs.
    # Their depth is staggered so that opposing QT plug reservations do not collide.
    ina_solids=raw['ina'].Solids()
    sensor_defs=[('pct',108,29.78),('tsl',136.5,39.78)]
    for name,x,z in sensor_defs:
        sensor=component_sensor(sources/(name+'.brd'),[ina_solids[5],ina_solids[6]])
        sensor=sensor.rotate((0,0,0),(1,0,0),-90).translate((x,99.43,z))
        add(name,sensor,'PCB + JST CAD + package envelopes',
            'Adafruit 25.4x17.78; top-facing, staggered in depth',name+'.brd')
        for side in ['l','r']:
            px=x-6 if side=='l' else x+25.4
            add(name+'_qt_'+side,box(px,101,z-8.89-3,6,3,6),
                'plug reservation','QT cable plug; nominal reserved volume, not actual harness')
    add('carrier',box(142,68,24,24,28,13),'reservation','TSR + ULN on cuttable prototype PCB; circuit layout not yet designed')
    add('radar',box(75,6,21,26,7,20),'reservation','18x22 radar module plus bracket/wire allowance; antenna faces bottom')
    add('fuse',box(105,85,10,60,13,13),'reservation','47.5x11 mm Littelfuse150-sized holder plus lead allowance; electrical fuse choice not approved')
    for i,y in [(1,21),(2,47)]:
        add('wago'+str(i),box(8,y,9,20,20,9),'reservation','WAGO 221-413 body allowance; lever access with Pi removed')
    for name,x in [('speaker_l',113),('speaker_r',132)]:
        add(name,box(x,0,9,12,14,12),'reservation','Insulated speaker-terminal allocation; actual panel part remains unspecified')
    add('screen_power_plug',box(100.5,11.2,6.6,9.5,7,4),'plug reservation','Display PH2 power plug allowance')
    add('hat_power_plug',box(110,5,24,20,14,13),'plug reservation','Right-angle barrel plug allowance; size to check against actual lead')
    add('hat_gpio_plug',box(76,72,20,52,8,10),'plug reservation','GPIO connector + lead allowance')
    add('ina_qt_bottom',box(147.89,29,30.4,6,6.6,3.1),'plug reservation','QT plug allowance')
    add('ina_qt_top',box(147.89,59.5,30.4,6,6.9,3.1),'plug reservation','QT plug allowance')
    add('pd_qt',box(142,9.17,30.4,6.64,6,3.1),'plug reservation','QT plug allowance')
    add('button_leads',box(81,84,22,14,7,12),'reservation','Crimp/solder + first wire bend allowance')
    add('routing_layer',box(35,14,16.5,119,70,2),'routing reservation',
        '2 mm nominal routing layer only; does not validate a complete FPC/cable path')
    # Material stack. No metal trim is added at the front.
    veneer_outer=rounded(0,0,.9,W,H,D-.9,7.4)
    core_outer=rounded(FINISH,FINISH,.9,W-2*FINISH,H-2*FINISH,D-.9,7.4-FINISH)
    # Front rebate derived from LCD slices behind the 0.7 mm cover glass.
    front_cut=rounded(GX+.55,GY+1.15,.75,163.8,101.9,7.2,.8)
    rear_cut=rounded(CORE+FINISH,CORE+FINISH,7.6,W-2*(CORE+FINISH),H-2*(CORE+FINISH),D,2.6)
    cutters=[front_cut,rear_cut]
    # Clearance pockets, not released panel cutouts / mounting hardware.
    cutters += [box(147.4,-1,24.4,21.52,7,13.2)]
    cutters += [box(x-.5,-1,8.5,13,6.5,13) for x in [113,132]]
    cutters += [cq.Solid.makeCylinder(8.3,25,cq.Vector(88,H-23,28),cq.Vector(0,1,0)),
                cq.Solid.makeCylinder(11.3,3.3,cq.Vector(88,H-8,28),cq.Vector(0,1,0)),
                box(16,H-6,31,48,7,4)]
    # Common inner cut also removes veneer inside all openings.
    core,veneer=core_outer,veneer_outer.cut(core_outer)
    for cutter in cutters:
        core=core.cut(cutter);veneer=veneer.cut(cutter)
    # Rear plate and its matching rebate are deliberately screw-free at this stage.
    plate=rounded(3.8,3.8,D-REAR,W-7.6,H-7.6,REAR,3.6)
    pocket=rounded(3.6,3.6,D-REAR-.05,W-7.2,H-7.2,REAR+.1,3.8)
    core=core.cut(pocket);veneer=veneer.cut(pocket)
    add('core',core,'case geometry','4 mm nominal birch-plywood rear wall; front rebated')
    add('veneer',veneer,'case geometry','0.8 mm finishing allowance; not veneer-only thickness')
    add('rear',plate,'case geometry','3 mm aluminium rear plate; mounting holes belong to step 4')
    return parts


def bbox_in_rear_void(b):
    """Guaranteed containment of all eight box vertices in the convex rear cut."""
    if b[4]<7.6-1e-5 or b[5]>D+7.6+1e-5:return False
    lo=CORE+FINISH;hi_x=W-lo;hi_y=H-lo;r=2.6
    for x,y in itertools.product([b[0],b[1]],[b[2],b[3]]):
        cx=min(max(x,lo+r),hi_x-r);cy=min(max(y,lo+r),hi_y-r)
        if (x-cx)**2+(y-cy)**2>r*r+1e-6:return False
    return True


def check(parts,output):
    # These are intentional mating/contact regions, not arbitrary ignored clashes.
    mating={frozenset(x) for x in [
        ('button','button_nut'),('button','button_leads'),
        ('screen','screen_power_plug'),('hat','hat_power_plug'),('hat','hat_gpio_plug'),
        ('ina','ina_qt_bottom'),('ina','ina_qt_top'),('pd','pd_qt'),
        ('pct','pct_qt_l'),('pct','pct_qt_r'),('tsl','tsl_qt_l'),('tsl','tsl_qt_r')]}
    collisions=[];tested=0;safe=0;void_rejections=0;results=[]
    bounds={n:bb(p['shape']) for n,p in parts.items()}
    solids={n:[(s,bb(s)) for s in p['shape'].Solids()] for n,p in parts.items()}
    for a,b in itertools.combinations(parts,2):
        if frozenset([a,b]) in mating:continue
        aa,bbx=bounds[a],bounds[b]
        if not overlaps(aa,bbx):safe+=1;continue
        if (a in ['core','veneer'] and bbox_in_rear_void(bbx)) or (b in ['core','veneer'] and bbox_in_rear_void(aa)):
            void_rejections+=1;continue
        # Booleans are run on individual solids after bbox rejection, not entire
        # assemblies. This keeps the check bounded and records actual intersections.
        volume=0.
        for sa,ba in solids[a]:
            for sb,bs in solids[b]:
                if (a in ['core','veneer'] and bbox_in_rear_void(bs)) or (b in ['core','veneer'] and bbox_in_rear_void(ba)):
                    continue
                if overlaps(ba,bs):
                    tested+=1;volume+=sa.intersect(sb).Volume()
        volume=round(volume,6)
        print('check',a,b,'intersection',volume,flush=True)
        results.append({'a':a,'b':b,'intersection_mm3':volume})
        if volume>.01:collisions.append(results[-1])
    manifest={n:{k:v for k,v in p.items() if k!='shape'}|{'bbox':bb(p['shape'])}
              for n,p in parts.items()}
    report={'revision':'D1','status':'nominal fit study; mounting, harness and prototype checks pending',
            'enclosure_mm':{'width':W,'height':H,'depth':D,'rear_plate':REAR,
              'wood_core_wall':CORE,'finish_allowance':FINISH,
              'visible_edge_x':GX,'visible_edge_y':GY,'front_rebate_clearance':GAP},
            'parts':manifest,'intersections':results,'unexpected_collisions':collisions,
            'bbox_rejections':safe,'rear_void_containment_rejections':void_rejections,'solid_boolean_checks':tested,
            'intentional_mating_pairs':[sorted(x) for x in mating],
            'not_verified':['actual delivered revisions','Pi as manufacturer STEP',
               'complete cable routing / FPC bend radius','speaker-terminal selection',
               'actual fuse-holder size','finished carrier circuit','fasteners / assembly access',
               'mechanical strength','thermal / RF / electrical performance']}
    output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    return report


class DSheet(Sheet):
    def __init__(self,c):
        super().__init__(c)
        self.svg=[s.replace('C1','D1') for s in self.svg]
    def header(self,sub,page):
        self.text(14,282,'DAW TUNEBOX  /  D1  /  MATERIAAL → PASSING',5,bold=True)
        self.text(14,274,sub,3.0,MUTED)
        self.line(14,268,406,268,GRID)
        self.line(14,20,406,20,GRID)
        self.text(14,13,'MAATVAST PASMODEL · GEEN PRODUCTIEVRIJGAVE · ALLE MATEN IN mm',2.6,MUTED)
        self.text(406,13,f'D1  /  {page} van 3',2.6,MUTED,align='right')


def drawings(parts):
    c=canvas.Canvas(str(OUT/'fit-d1.pdf'),pagesize=(420*mm,297*mm),pageCompression=1)
    c.setTitle('TuneBox D1 — material-led fit prototype')
    # Sheet 1: projected layout with distinct low/front parts.
    s=DSheet(c);s.header('Scherm en hoofdprinten: fabrikant-CAD waar beschikbaar; overige volumes herkenbaar als reservering.',1)
    ox,oy,k=18,84,1.45
    X=lambda x:ox+k*x;Y=lambda y:oy+k*y
    s.rect(X(0),Y(0),W*k,H*k,'#8b6543',INK,.4,7.4*k)
    s.rect(X(4.8),Y(4.8),(W-9.6)*k,(H-9.6)*k,'#fbfcfb',GRID,.3,2.6*k)
    s.rect(X(GX),Y(GY),170.18*k,104.2*k,'none','#abb3b7',.2,4.5*k,dash=True)
    for n in ['fuse','wago1','wago2','speaker_l','speaker_r']:
        b=bb(parts[n]['shape']);s.rect(X(b[0]),Y(b[2]),(b[1]-b[0])*k,(b[3]-b[2])*k,'none',COLOURS.get(n,MUTED),.35,dash=True)
        s.text(X((b[0]+b[1])/2),Y((b[2]+b[3])/2),{'fuse':'ZEKERING · VOORSTE LAAG','wago1':'WAGO','wago2':'WAGO','speaker_l':'L','speaker_r':'R'}[n],2.3,COLOURS.get(n,MUTED),True,'center')
    labels={'pi':['Pi4','reservering incl. poorten'], 'hat':['Louder Plus1X','Rev F · echte CAD'],
            'pd':['USB-C PD'],'ina':['INA228'],'carrier':['TSR + ULN','carrierreserve'],'radar':['RADAR','naar onderzijde']}
    for n in ['pi','hat','pd','ina','carrier','radar']:
        b=bb(parts[n]['shape']);col=COLOURS[n]
        s.rect(X(b[0]),Y(b[2]),(b[1]-b[0])*k,(b[3]-b[2])*k,'none',col,.45)
        # transparent schematic volumes: lower parts remain visible.
        for i,t in enumerate(labels[n]):s.text(X((b[0]+b[1])/2),Y((b[2]+b[3])/2)+2-i*4.5,t,3 if n in ['pi','hat'] else 2.55,col,i==0,'center')
    for n,label in [('pct','TEMPERATUUR'),('tsl','LICHT')]:
        b=bb(parts[n]['shape']);s.rect(X(b[0]),Y(98.5),(b[1]-b[0])*k,5.5*k,'#e8f3ed','#41836e',.3)
        s.text(X((b[0]+b[1])/2),Y(100.5),label,2.2,'#41836e',True,'center')
    s.circle(X(88),Y(105),4.5,'#f7f0df','#a97d38',.35)
    s.text(X(88),Y(89),'KNOP',2.6,'#9b693b',True,'center')
    s.dimx(X(0),X(W),Y(115),f'{W:.0f}  kastbreedte van pasmodel')
    s.dimx(X(GX),X(GX+170.18),Y(-8),'170,18  bestaand glas')
    s.lines(296,250,['MATERIAALBASIS','Bestaand glazen touchfront.','Berkenmultiplex + walnootfineer.','Aluminium achterplaat 3 mm.','Geen metalen voorrand toegevoegd.'],3.1,MUTED,leading=6)
    s.lines(296,205,['AFGELEIDE PASMAAT',f'{W:.0f} × {H:.0f} × {D:.0f} mm kast.',f'Glasrand → hout: circa {GX:.1f} mm.',
       'Knop steekt 1,5 mm boven de kast.','Wandophanging komt daar nog achter.'],3.1,MUTED,leading=6)
    s.lines(296,160,['SLIM RUIMTEGEBRUIK','Pi en HAT naast elkaar.','Sensoren tegen bovenwand.','Lage delen vóór hoofdprinten.','Sensorstekkers versprongen in diepte.'],3.1,MUTED,leading=6)
    s.lines(296,115,['CONTROLEGRENZEN','Pi is een conservatieve omhullende.','Carrier / klemmen zijn reserveringen.','Kabelloop en bevestiging volgen.','Thermisch en RF nog op hardware testen.'],2.9,MUTED,leading=6)
    s.text(18,54,'Doorgetrokken: hoofdonderdelen. Gestreept: lage voorste delen / reserveringen. Kijkrichting vanaf het scherm.',2.9,MUTED)
    s.text(18,45,'PCBs liggen naast elkaar; losse aansluitdelen benutten plaatselijk een andere dieptelaag.',2.9,MUTED)
    s.text(18,36,'De kastmaat komt uit de sponning en 3D-opstelling; de render levert geen millimeters.',2.9,bold=True)
    s.save_svg(OUT/'fit-d1-layout.svg');c.showPage()
    # Sheet 2: side layer and top sensor stagger.
    s=DSheet(c);s.header('Doorsnede en vrije lagen — Z loopt vanaf het glas naar de achterzijde.',2)
    x0,y0,ks=27,164,4.2
    segments=[(0,.7,'GLAS','#273038'),(.7,14.6,'SCHERMMODULE','#dfe4e6'),
              (15.3,3.7,'TUSSENRUIMTE','#ffffff'),(19,22,'Pi-RESERVE','#e3eff5'),
              (41,1,'VRIJ','#ffffff'),(42,3,'ALU','#aab7bd')]
    for z,d,label,fill in segments:
        s.rect(x0+ks*z,y0,ks*d,55,fill,INK,.3)
        if d>3:s.text(x0+ks*(z+d/2),y0+24,label,2.7,align='center')
        s.dimx(x0+ks*z,x0+ks*(z+d),y0-8,format(d,'.1f').replace('.',','))
    s.dimx(x0,x0+D*ks,y0-20,f'{D:.0f} mm kastdiepte, vanaf glasvoorzijde')
    s.lines(253,225,['SCHERM: GEEN DIKTESCHATTING','STEP-omhullende: 15,30 mm.','Incl. gemodelleerde connectoren en bussen.','Pluggen zijn afzonderlijk gereserveerd.'],3,MUTED,leading=6)
    s.lines(253,185,['HOUTEN SPONNING','0,8 mm afwerkingsruimte.','4 mm nominale kernwand achterin.','Voorin vrijgefreesd rond schermmodule.','Circa 2,9 mm zichtbare houten kant.'],3,MUTED,leading=6)
    s.text(18,115,'PLAATSELIJK GEBRUIK VAN DE DIEPTE',3.7,bold=True)
    s.lines(18,104,['WAGO-reserves: Z 9–18 vóór de Pi; daar is het scherm ondieper dan op zijn hoogste punten.',
       'Zekeringhouder: Z 10–23 vóór de bovenste carrier; de werkelijke houder moet binnen zijn reservering vallen.',
       'Temperatuur-PCB: Z 12–29,78. Licht-PCB: Z 22–39,78. Zo kruisen de QT-pluggen elkaar niet.',
       'Routinglaag: Z 16,5–18,5, alleen waar de modellen die ruimte vrijlaten.',
       'Dat is een vrije laag voor ontwerp, geen bewijs van de volledige kabelroute of toegestane FPC-buigradius.'],3,MUTED,leading=7)
    s.text(18,54,'VOLGENDE FASE: bevestiging, montagevolgorde en echte kabels; daarna pas afmetingen vrijgeven.',3.1,bold=True)
    s.save_svg(OUT/'fit-d1-section.svg');c.showPage()
    # Sheet 3: actual screen geometry reference with front footprint.
    s=DSheet(c);s.header('1:1 front- en binnenruimtecontrole; print op 100%, controleer de 50 mm maatbalk.',3)
    ox,oy=25,91
    s.rect(ox,oy,W,H,'none',INK,.3,7.4)
    s.rect(ox+GX,oy+GY,170.18,104.2,'none','#26323b',.25,4.5)
    s.rect(ox+GX+.55,oy+GY+1.15,163.8,101.9,'none','#9b693b',.2,.8,dash=True)
    s.rect(ox+4.8,oy+4.8,W-9.6,H-9.6,'none','#41836e',.2,2.6,dash=True)
    s.dimx(ox,ox+50,oy-12,'50,00 mm controlemaat')
    s.lines(240,215,['Zwart: bestaande glasomtrek.','Bruin: vrijruimte van de voorste sponning.',
       'Groen: nominale holte achterin.', '', 'Buitenmaat volgt uit materiaal + passing.',
       'Dit blad is geen boor- of CNC-vrijgave.', 'Geen montagegaten toegevoegd voordat',
       'de complete bevestiging is uitgewerkt.'],3,MUTED,leading=7)
    s.save_svg(OUT/'fit-d1-template.svg');c.showPage();c.save()
    import fitz
    pdf=fitz.open(OUT/'fit-d1.pdf')
    for i,n in [(0,'layout'),(1,'section')]:
        pdf[i].get_pixmap(matrix=fitz.Matrix(1.6,1.6)).save(OUT/f'fit-d1-{n}.png')


def export_own_geometry(parts):
    asm=cq.Assembly(name='TuneBox_D1_CASE_AND_LABELLED_RESERVATIONS')
    for n in ['core','veneer','rear']:
        col={'core':(.55,.4,.27),'veneer':(.40,.24,.13),'rear':(.64,.69,.72)}[n]
        asm.add(parts[n]['shape'],name=n,color=cq.Color(*col))
    for n,p in parts.items():
        if n in ['core','veneer','rear']:continue
        b=bb(p['shape']);s=box(b[0],b[2],b[4],b[1]-b[0],b[3]-b[2],b[5]-b[4])
        asm.add(s,name=n+'_REFERENCE_ENVELOPE',color=cq.Color(.24,.43,.51,.4))
    asm.export(str(OUT/'fit-d1-case-and-reservations.step'))
    cq.exporters.export(parts['core']['shape'],str(OUT/'fit-d1-core.stl'),tolerance=.15)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--sources',type=Path,required=True)
    parser.add_argument('--skip-check',action='store_true')
    args=parser.parse_args();parts=build(args.sources)
    print('Built',len(parts),'parts / reserved volumes',flush=True)
    drawings(parts);export_own_geometry(parts)
    print('Drawings and own case exports written',flush=True)
    manifest={n:{k:v for k,v in p.items() if k!='shape'}|{'bbox':bb(p['shape'])}
              for n,p in parts.items()}
    (OUT/'fit-d1-parts.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    if not args.skip_check:
        report=check(parts,OUT/'fit-d1-check.json')
        print('Unexpected intersections:',len(report['unexpected_collisions']),flush=True)
        if report['unexpected_collisions']:raise SystemExit(2)


if __name__=='__main__':main()
