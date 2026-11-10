#!/usr/bin/env python3
"""Build TuneBox C1 fit drawings and a labelled envelope STEP.

Python 3, reportlab, PyMuPDF; CadQuery is optional for STEP export.
No vendor CAD is redistributed. Models are our own reserved volumes.
This checks planar PCB reservations, not a fitted/thermal/electrical assembly.
"""
from pathlib import Path
import csv
import html
import json
import math
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads(Path(__file__).with_name('layout.json').read_text())
OUT = ROOT / 'docs' / 'design'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 420, 297
INK, MUTED, GRID = '#23343a', '#53676e', '#ced6d8'
COL = {'pi':'#236b8e','hat':'#91602e','pd':'#875a99','ina':'#875a99',
       'pct':'#41836e','tsl':'#41836e','carrier':'#875a99','radar':'#41836e'}
FILL = {'pi':'#e4f0f5','hat':'#f4eade','pd':'#f1eaf5','ina':'#f1eaf5',
        'pct':'#e9f4ef','tsl':'#e9f4ef','carrier':'#f1eaf5','radar':'#e9f4ef'}
font_dir = Path('/usr/share/fonts/truetype/dejavu')
pdfmetrics.registerFont(TTFont('DV', str(font_dir / 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DVB', str(font_dir / 'DejaVuSans-Bold.ttf')))


def verify():
    boards = DATA['boards']
    gaps = []
    for a in boards:
        assert a['x'] >= 5 and a['x']+a['w'] <= 185, a['id']
        assert a['y'] >= (0 if a['id']=='pd' else 5), a['id']
        assert a['y']+a['h'] <= 119, a['id']
        for x,y in a['holes']:
            assert 0 <= x <= a['w'] and 0 <= y <= a['h'], (a['id'],x,y)
        for b in boards:
            if a['id'] >= b['id']:
                continue
            dx = max(a['x']-b['x']-b['w'], b['x']-a['x']-a['w'], 0)
            dy = max(a['y']-b['y']-b['h'], b['y']-a['y']-a['h'], 0)
            distance = math.hypot(dx,dy)
            assert distance >= DATA['minimum_planar_gap'], (a['id'],b['id'],distance)
            gaps.append({'a':a['id'],'b':b['id'],'gap_mm':round(distance,3)})
    assert DATA['enclosure']['body_depth']-DATA['enclosure']['rear_plate']-22-22 >= 3
    report = {'revision':DATA['revision'], 'checks':['PCB reservations inside enclosure',
              'No pair of PCB/reserved-module rectangles overlaps', 'At least 3 mm between PCB rectangles',
              'Local mounting coordinates inside each PCB rectangle', 'Nominal depth reservations fit'],
              'not_checked':['connector bodies / inserted plugs','screw heads / tools / cable bends',
              'screen PCB/posts at delivered revision','thermal contacts and temperatures','RF performance',
              'carrier circuit design','electrical protection / bonding / power wiring'],
              'minimum_gap_mm':min(x['gap_mm'] for x in gaps),'gaps':gaps}
    (OUT/'wall-layout-check.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


class Sheet:
    def __init__(self,c):
        self.c=c
        self.svg=['<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297">',
                  '<title>DAW TuneBox C1 — maatvaste pasproef</title>',
                  '<desc>PCB-reserveringen en montagecoördinaten, geen productievrijgave. Alle maten in mm.</desc>']
        self.rect(0,0,W,H,'#ffffff','#ffffff')
    def style(self,stroke,width,dash=None):
        self.c.setStrokeColor(stroke);self.c.setLineWidth(width*mm)
        self.c.setDash([2*mm,1.2*mm] if dash else [])
    def rect(self,x,y,w,h,fill='none',stroke=INK,width=.25,r=0,dash=None):
        self.style(stroke,width,dash)
        if fill!='none':self.c.setFillColor(fill)
        if r:self.c.roundRect(x*mm,y*mm,w*mm,h*mm,r*mm,stroke=1,fill=fill!='none')
        else:self.c.rect(x*mm,y*mm,w*mm,h*mm,stroke=1,fill=fill!='none')
        self.svg.append(f'<rect x="{x}" y="{H-y-h}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"'+(' stroke-dasharray="2 1.2"' if dash else '')+'/>')
    def line(self,x1,y1,x2,y2,color=INK,width=.25,dash=False):
        self.style(color,width,dash);self.c.line(x1*mm,y1*mm,x2*mm,y2*mm)
        self.svg.append(f'<line x1="{x1}" y1="{H-y1}" x2="{x2}" y2="{H-y2}" stroke="{color}" stroke-width="{width}"'+(' stroke-dasharray="2 1.2"' if dash else '')+'/>')
    def circle(self,x,y,r,fill='none',stroke=INK,width=.25):
        self.style(stroke,width)
        if fill!='none':self.c.setFillColor(fill)
        self.c.circle(x*mm,y*mm,r*mm,stroke=1,fill=fill!='none')
        self.svg.append(f'<circle cx="{x}" cy="{H-y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>')
    def text(self,x,y,t,size=3,color=INK,bold=False,align='left'):
        self.c.setFont('DVB' if bold else 'DV',size*mm);self.c.setFillColor(color)
        fn={'left':self.c.drawString,'center':self.c.drawCentredString,'right':self.c.drawRightString}[align]
        fn(x*mm,y*mm,t)
        anch={'left':'start','center':'middle','right':'end'}[align]
        self.svg.append(f'<text x="{x}" y="{H-y}" font-family="DejaVu Sans, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}" text-anchor="{anch}">{html.escape(t)}</text>')
    def lines(self,x,y,lines,size=3,color=INK,bold=False,leading=4.8):
        for i,t in enumerate(lines):self.text(x,y-i*leading,t,size,color,bold)
    def dimx(self,x1,x2,y,t,color=MUTED):
        self.line(x1,y,x2,y,color,.2)
        for x in [x1,x2]:self.line(x-1,y-1.4,x+1,y+1.4,color,.25)
        self.text((x1+x2)/2,y+1.6,t,2.8,color,align='center')
    def header(self,sub,page):
        self.text(14,282,'DAW TUNEBOX  /  TECHNISCHE INDELING C1',5.0,bold=True)
        self.text(14,274,sub,3.1,MUTED)
        self.line(14,268,406,268,GRID)
        self.line(14,20,406,20,GRID)
        self.text(14,13,'10 NOV 2026  ·  ALLE MATEN IN mm  ·  COÖRDINATEN VOOR PASPROEF',2.6,MUTED)
        self.text(406,13,f'C1   /   {page} van 3',2.6,MUTED,align='right')
    def save_svg(self,path):path.write_text('\n'.join(self.svg+['</svg>'])+'\n')


def main_sheet(c):
    s=Sheet(c);s.header('Binnenzijde achterplaat, scherm weggenomen. Pi, HAT en hulpprinten naast elkaar.',1)
    ox,oy,k=16,78,1.4
    X=lambda x:ox+k*x
    Y=lambda y:oy+k*y
    s.rect(X(0),Y(0),190*k,124*k,'#e5e9eb',INK,.5,6*k)
    s.rect(X(5),Y(5),180*k,114*k,'#f9fbfb',GRID,.3,2*k)
    # Glass reference is a projected outline; electronics occupy a different depth.
    gx=(190-170.18)/2;gy=(124-104.2)/2
    s.rect(X(gx),Y(gy),170.18*k,104.2*k,'none','#aab5b9',.2,dash=True)
    for n,b in enumerate(DATA['boards'],1):
        x,y,w,h=[b[a] for a in ['x','y','w','h']];col=COL[b['id']]
        s.rect(X(x),Y(y),w*k,h*k,FILL[b['id']],col,.4,r=1.4)
        names={'pi':['01  RASPBERRY PI 4','85 × 56 · 90° gedraaid'],
               'hat':['02  LOUDER HAT','PLUS 1X  /  REV F','65,00 × 61,38'],
               'pd':['03  USB-C PD','HUSB238'], 'ina':['04  INA228','stroom / vermogen'],
               'pct':['05  PCT2075','lucht °C'],'tsl':['06  TSL2591','licht · lux'],
               'carrier':['07  TSR + ULN','31 × 24 gereserveerd'],
               'radar':['08  mmWAVE','RF-proefzone']}[b['id']]
        fs=3.4 if b['id'] in ['pi','hat'] else 2.65
        cy=Y(31 if b['id']=='pi' else y+h/2)+(len(names)-1)*2.35
        for i,t in enumerate(names):s.text(X(x+w/2),cy-i*4.7,t,fs,col,i==0,'center')
        for i,(hx,hy) in enumerate(b['holes']):
            px,py=X(x+hx),Y(y+hy)
            s.circle(px,py,1.5*k,'#ffffff',col,.3)
            if b['id'] in ['pi','hat']:
                if i in b['screws']:
                    s.line(px-1.2,py,px+1.2,py,col,.3);s.line(px,py-1.2,px,py+1.2,col,.3)
                else:s.circle(px,py,.5,fill=col,stroke=col)
    # Separately marked functions, not unverified connector geometry.
    s.rect(X(29),Y(104.5),22*k,19.5*k,'none','#9d763c',.3,dash=True)
    s.text(X(40),Y(116),'KNOP Ø16',2.8,'#9d763c',True,'center')
    s.text(X(40),Y(111),'inbouwreserve',2.4,'#9d763c',align='center')
    s.rect(X(32.5),Y(57.5),22*k,22*k,'none','#c26b38',.3,dash=True)
    s.text(X(43.5),Y(53),'SoC → warmtebrug*',2.6,'#a6522c',align='center')
    s.line(X(164),Y(117.78),X(164),Y(123.5),'#41836e',.8)
    s.text(X(79),Y(5),'RF-venster in onderwand',2.45,'#41836e')
    # Datums.
    s.circle(X(0),Y(0),1.2,'#ffffff',INK,.3)
    s.line(X(0),Y(0),X(12),Y(0),INK,.45);s.line(X(0),Y(0),X(0),Y(12),INK,.45)
    s.text(X(0)-1,Y(0)-6,'0,0',2.7)
    s.dimx(X(0),X(190),Y(129),'190,00  buitenmaat')
    s.dimx(X(5),X(185),Y(-9),'180,00  nominaal binnen de houten wand')
    s.line(8,Y(0),8,Y(124),MUTED,.2)
    for yy in [Y(0),Y(124)]:s.line(6.6,yy-1,9.4,yy+1,MUTED,.25)
    s.text(6,Y(62),'124,00',2.7,MUTED,align='center')
    # I/O below main view.
    s.text(16,53,'I/O-CASSETTE ONDERZIJDE  /  105 × 18 GERESERVEERD',3.1,bold=True)
    io=DATA['io'];p0=73;scale=1.4
    s.rect(p0,30,105*scale,18,'#f4f0e8','#9d763c',.35)
    for name,x in io['centres'].items():
        xx=p0+(x-io['strip_x'])*scale
        lab={'speaker_l':'L','usb_c':'USB-C','speaker_r':'R'}[name]
        s.circle(xx,39,3,'#ffffff','#9d763c',.3)
        s.text(xx,37.9,lab,2.6,'#9d763c',True,'center')
    s.text(16,24,'Symbolen zijn reserveringen; geen gefingeerde boorgaten voor onbekende paneelklemmen.',2.6,MUTED)
    # Right hand notes, short enough to be legible.
    rx=301
    sections=[(255,'MAATBASIS',[ 'Kast: 190 × 124 × 50.', 'Achterplaat: aluminium 3.', 'Walnoot zijwand: 5 nominale dikte.', 'Wandafstand: 5 gereserveerd.', '55 wandprojectie blijft een doelmaat.']),
      (216,'MONTAGE',[ 'Pi + HAT: elk 2 diagonale schroeven.', 'Daarnaast elk 2 passieve steunvoetjes.', 'Geen gedeelde bouten door het LCD.', 'Montagevoeten: geschroefd heeft voorkeur.', 'Gelijmde voeten alleen na lijmproef.']),
      (177,'WARMTE',[ 'Pi-SoC via passende metalen brug', 'en isolerend thermisch raakvlak naar alu.', 'HAT via daarvoor geschikte PCB-zone;', 'geen willekeurige druk op componenten.', 'Thermische delen zijn geen printlijm.']),
      (138,'SENSOREN EN RADIO',[ 'PCT op nylon; los van hete achterplaat.', 'TSL via lichtgeleider naar boven.', 'Radar bij een niet-metalen bodemvenster.', 'Wi-Fi en radar in gesloten kast testen.', 'Kabels krijgen trekontlasting.']),
      (99,'GECONTROLEERD',[ 'Openbare fabrikant-CAD gebruikt.', 'Geen overlap van PCB-reserveringen.', 'Kleinste tussenruimte: circa 4,00 mm.', 'Stekkers en kabels nog passen in 3D.', '* Warmtebrugzone is indicatief.'])]
    for y,title,lines in sections:
        s.text(rx,y,title,3.2,bold=True)
        s.lines(rx,y-7,lines,2.85,MUTED,leading=4.7)
    s.rect(rx,28,105,28,'#fcf3e6','#b27735',.25,2)
    s.lines(rx+4,47,['BRONMATEN ≠ BEWEZEN MINIMUMDIKTE.', 'Plaatsing en hoofdgatpatronen zijn vastgelegd;', 'pasproef, warmte en I/O bepalen vrijgave.'],2.7,'#895b26',leading=5)
    s.save_svg(OUT/'wall-rear-layout.svg')


def coordinates_sheet(c):
    s=Sheet(c);s.header('Montagecoördinaten en dieptebudget — dezelfde aanzichtzijde als blad 1.',2)
    s.text(14,255,'HOOFDPRINTEN  /  POSITIES VAN BOREN OF GELIJMDE MONTAGEVOETEN',3.6,bold=True)
    s.lines(14,247,['X/Y vanaf linkeronderhoek van de kast. Niet spiegelen vanaf de buitenzijde van de achterplaat.',
       'M2,5 bevestiging; HAT-brongat circa Ø3,048, standaard raster circa 58 × 49. PCB-gaten zijn geen boormaat voor de alu-plaat.'],2.9,MUTED,leading=5)
    cols=[14,58,96,134,170,231]
    for x,t in zip(cols,['Onderdeel','Punt','X','Y','Functie','Bron']):s.text(x,230,t,3,bold=True)
    s.line(14,225,405,225,GRID)
    y=218
    for b in DATA['boards'][:2]:
        for i,(hx,hy) in enumerate(b['holes']):
            vals=[b['name'] if i==0 else '', str(i+1),f'{b["x"]+hx:.3f}',f'{b["y"]+hy:.3f}',
                  'Schroef' if i in b['screws'] else 'Steun zonder bout', 'Pi figuur 1' if b['id']=='pi' else 'Sonocotta Rev F STEP + drill']
            for x,t in zip(cols,vals):s.text(x,y,t,2.8, COL[b['id']] if i==0 else INK)
            s.line(14,y-3,405,y-3,GRID,.15);y-=8
        y-=3
    s.text(14,132,'VOORGESTELD DIEPTEBUDGET  /  ALLEEN RESERVERINGEN',3.6,bold=True)
    # Side section; rear plate at left, front at right, display keeps its own mounts.
    x0,y0,ks=25,64,2.9
    items=[(0,3,'Alu','#aab8be'),(3,22,'Elektronica','#e4f0f5'),(25,3,'Vrij','#ffffff'),(28,22,'LCD-reserve','#e8e9e9')]
    for x,w,lab,fill in items:
        s.rect(x0+x*ks,y0,w*ks,48,fill,INK,.35)
        s.text(x0+(x+w/2)*ks,y0+23,lab,2.5,align='center')
        s.dimx(x0+x*ks,x0+(x+w)*ks,y0-7,str(w))
    s.dimx(x0,x0+50*ks,y0-17,'50 mm kastdiepte · nog geen gemeten minimum')
    s.lines(197,116,['Pi: componentzijde naar de achterplaat.', '18 mm datum tot de onderzijde van de PCB.',
       'Metalen warmtebrug op maat, geen dikke stapel pads.', 'HAT: PCB-onderzijde 6 mm van alu; componenten naar LCD.',
       'LCD 22 mm is een gereserveerd volume, geen bronmaat.', '3 mm nominale vrije ruimte is voor de pasproef.',
       'Geen gekruiste voeding of ongeteste GPIO-kabel uit dit model.'],2.9,MUTED,leading=6)
    s.text(14,34,'1:1 TEMPLATE: wall-mount-template.svg / .dxf. Print PDF-blad 3 op 100%, controleer de 50 mm maatbalk.',2.9,bold=True)
    s.save_svg(OUT/'wall-rear-coordinates.svg')


def template_sheet(c):
    s=Sheet(c);s.header('1:1 pas- en positioneersjabloon — print op ware grootte, geen automatische schaling.',3)
    ox,oy=25,87
    s.rect(ox,oy,190,124,'none',INK,.3,r=6)
    for b in DATA['boards']:
        s.rect(ox+b['x'],oy+b['y'],b['w'],b['h'],'none',COL[b['id']],.2,dash=b['id'] in ['carrier','radar'])
        for i,(hx,hy) in enumerate(b['holes']):
            x,y=ox+b['x']+hx,oy+b['y']+hy
            s.circle(x,y,1.5,'none',COL[b['id']],.18)
            s.line(x-3,y,x+3,y,COL[b['id']],.18)
            s.line(x,y-3,x,y+3,COL[b['id']],.18)
    s.dimx(ox,ox+50,oy-12,'50,00 mm controlemaat')
    s.lines(246,207,['MONTEREN VANUIT DEZELFDE ZIJDE', 'ALS DE TEKENING OP BLAD 1.', '',
       'Dit sjabloon geeft harten, geen tap- of boormaten.', 'Controleer de geleverde print tegen het sjabloon.',
       'Rev F is publiek; F1 kan afwijken.', 'Printen, stekkers en scherm moeten vrij liggen.', '',
       'Sensoren komen in losse nylon houdertjes.', 'Carrier en radar zijn gereserveerde zones.',
       'Schermgaten zijn bewust niet overgenomen', 'naar de achterplaat; het LCD heeft eigen montage.', '',
       'Geef CNC pas vrij na de complete pasproef.'],3.0,MUTED,leading=6)
    s.save_svg(OUT/'wall-mount-template-sheet.svg')


def exports():
    # Units are actual mm, the DXF contains positioning crosses, not drill diameters.
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="190mm" height="124mm" viewBox="0 0 190 124">',
         '<title>TuneBox C1 1:1 position template — not a drill release</title>',
         '<rect x="0" y="0" width="190" height="124" rx="6" fill="none" stroke="black" stroke-width="0.2"/>']
    dxf=['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES']
    def line(x1,y1,x2,y2,layer):
        dxf.extend(map(str,['0','LINE','8',layer,'10',x1,'20',y1,'30',0,'11',x2,'21',y2,'31',0]))
    # Straight outline is marked an envelope, not the rounded machined profile.
    for a,b in [((0,0),(190,0)),((190,0),(190,124)),((190,124),(0,124)),((0,124),(0,0))]:line(*a,*b,'ENVELOPE_REFERENCE')
    rows=[]
    for b in DATA['boards']:
        x,y,w,h=[b[t] for t in ['x','y','w','h']]
        svg.append(f'<rect x="{x}" y="{124-y-h}" width="{w}" height="{h}" fill="none" stroke="{COL[b["id"]]}" stroke-width="0.2"/>')
        for i,(hx,hy) in enumerate(b['holes']):
            x,y=round(b['x']+hx,3),round(b['y']+hy,3)
            line(x-2,y,x+2,y,'MOUNT_CENTRES_'+b['id'].upper())
            line(x,y-2,x,y+2,'MOUNT_CENTRES_'+b['id'].upper())
            svg.append(f'<path d="M{x-2},{124-y}h4 M{x},{124-y-2}v4" fill="none" stroke="{COL[b["id"]]}" stroke-width="0.2"/>')
            rows.append([b['id'],i+1,x,y,'screw' if i in b.get('screws',range(9)) else 'passive support'])
    svg.append('<path d="M5,120h50 M5,118v4 M55,118v4" fill="none" stroke="black" stroke-width="0.2"/>')
    svg.append('<text x="30" y="117" font-size="2.8" text-anchor="middle">50 mm</text></svg>')
    (OUT/'wall-mount-template.svg').write_text('\n'.join(svg)+'\n')
    (OUT/'wall-mount-template.dxf').write_text('\n'.join(dxf+['0','ENDSEC','0','EOF'])+'\n')
    with (OUT/'wall-mount-centres.csv').open('w',newline='') as f:
        writer=csv.writer(f);writer.writerow(['part','point','x_mm','y_mm','function']);writer.writerows(rows)


def step_export():
    try:import cadquery as cq
    except ImportError:
        print('STEP skipped: install cadquery');return
    # Z=0 inner rear plate; positive Z toward the display. No vendor STEP reused.
    asm=cq.Assembly(name='TuneBox_C1_RESERVED_VOLUMES_NOT_MANUFACTURING')
    plate=cq.Workplane('XY').box(190,124,3,centered=(False,False,False)).translate((0,0,-3))
    plate=plate.edges('|Z').fillet(6)
    asm.add(plate,name='Rear_plate_blank_no_drilling',color=cq.Color(.65,.69,.72))
    for b in DATA['boards']:
        volume=cq.Workplane('XY').box(b['w'],b['h'],b['z_reservation'],centered=(False,False,False)).translate((b['x'],b['y'],0))
        rgb=tuple(int(COL[b['id']][i:i+2],16)/255 for i in [1,3,5])
        asm.add(volume,name=b['id']+'_KEEP_OUT_NOT_DETAILED_MODEL',color=cq.Color(*rgb))
    e=DATA['enclosure'];sc=DATA['screen']
    screen=cq.Workplane('XY').box(sc['glass_width'],sc['glass_height'],22,centered=(False,False,False)).translate(((190-sc['glass_width'])/2,(124-sc['glass_height'])/2,25))
    asm.add(screen,name='Screen_22mm_DESIGN_ALLOWANCE_not_measured_thickness',color=cq.Color(.1,.12,.14,.35))
    asm.export(str(OUT/'wall-layout-envelopes.step'))


if __name__=='__main__':
    report=verify()
    c=canvas.Canvas(str(OUT/'wall-rear-layout.pdf'),pagesize=(W*mm,H*mm),pageCompression=1)
    c.setTitle('DAW TuneBox C1 — dimensioned fit prototype')
    c.setAuthor('DAW TuneBox project')
    for fn in [main_sheet,coordinates_sheet,template_sheet]:fn(c);c.showPage()
    c.save();exports();step_export()
    import fitz
    doc=fitz.open(OUT/'wall-rear-layout.pdf')
    doc[0].get_pixmap(matrix=fitz.Matrix(1.6,1.6)).save(OUT/'wall-rear-layout.png')
    doc[1].get_pixmap(matrix=fitz.Matrix(1.3,1.3)).save(OUT/'wall-rear-coordinates.png')
    print('Generated C1 PDF/SVG/PNG/DXF/CSV and STEP reserved volumes.')
    print('Minimum PCB reservation gap:',report['minimum_gap_mm'],'mm; assembly fit still to be tested.')
