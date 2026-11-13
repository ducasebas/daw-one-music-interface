/* Touch appliance boundary. Loaded before the app, including boot recovery pages. */
(() => {
  const query=new URLSearchParams(location.search);
  if(query.get('display')!=='dsi-production'||query.get('setup')==='phone')return;
  const root=document.documentElement;
  root.dataset.tuneboxKiosk='true';root.setAttribute('translate','no');
  const text=(en,nl)=>root.lang==='nl'?nl:en;
  let dialog;
  function message(title,body,url){
    const event=new CustomEvent('tunebox:handoff',{detail:{title,body,url},cancelable:true});
    if(!window.dispatchEvent(event))return;
    dialog?.remove();dialog=document.createElement('dialog');dialog.className='appliance-message';
    dialog.setAttribute('aria-label',title);
    const h=document.createElement('h2'),p=document.createElement('p'),close=document.createElement('button');
    h.textContent=title;p.textContent=body;close.textContent=text('Close','Sluiten');close.onclick=()=>dialog.close();
    dialog.append(h,p);
    if(url){const code=document.createElement('code');code.textContent=url;dialog.append(code);}
    dialog.append(close);document.body.append(dialog);dialog.showModal();return dialog;
  }
  const handoff=(url,download=false)=>message(
    text(download?'Export from another device':'Open on another device',download?'Exporteren vanaf een ander apparaat':'Openen op een ander apparaat'),
    text(download?'Open TuneBox on your computer to download this file.':'Use your phone or computer to open this link.',download?'Open TuneBox op je computer om dit bestand te downloaden.':'Open deze link op je telefoon of computer.'),download?undefined:url);
  async function guide(url){
    const panel=message(text('TuneBox help','TuneBox-hulp'),text('Loading guide…','Handleiding laden…'));
    if(!panel)return;
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error();
      const value=await response.text();if(value.length>131072)throw Error();
      const body=document.createElement('pre');body.className='appliance-guide';body.textContent=value;
      panel.querySelector('p').replaceWith(body);
    }catch{panel.querySelector('p').textContent=text('This guide is unavailable. Try again when TuneBox is connected.','Deze handleiding is niet beschikbaar. Probeer opnieuw wanneer TuneBox verbonden is.');}
  }
  const inputTarget=e=>e.target instanceof Element&&e.target.closest('input,textarea,[contenteditable="true"]');
  function choose(select){
    if(select.disabled)return;
    dialog?.remove();dialog=document.createElement('dialog');dialog.className='appliance-message appliance-options';
    const title=select.getAttribute('aria-label')||select.labels?.[0]?.childNodes[0]?.textContent?.trim()||text('Choose an option','Kies een optie');
    dialog.setAttribute('aria-label',title);select.setAttribute('aria-expanded','true');
    const heading=document.createElement('h2'),list=document.createElement('div'),cancel=document.createElement('button');
    heading.textContent=title;list.setAttribute('role','listbox');cancel.textContent=text('Cancel','Annuleren');cancel.onclick=()=>dialog.close();
    for(const option of select.options){
      const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.selected));
      button.disabled=option.disabled||option.parentElement?.disabled===true;
      button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();};
      if(option.selected)button.autofocus=true;list.append(button);
    }
    dialog.addEventListener('close',()=>{select.setAttribute('aria-expanded','false');select.focus();},{once:true});
    dialog.append(heading,list,cancel);document.body.append(dialog);dialog.showModal();
  }
  const stop=e=>e.preventDefault();
  for(const name of ['contextmenu','selectstart','dragstart'])document.addEventListener(name,stop,true);
  document.addEventListener('dblclick',e=>{e.preventDefault();const input=inputTarget(e);if(input?.setSelectionRange)try{input.setSelectionRange(input.value.length,input.value.length);}catch{}window.getSelection()?.removeAllRanges();},true);
  document.addEventListener('gesturestart',stop,{capture:true,passive:false});
  document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{capture:true,passive:false});
  document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)e.preventDefault();},{capture:true,passive:false});
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase(),modifier=e.ctrlKey||e.metaKey;
    if(e.target instanceof HTMLSelectElement&&[' ','enter','arrowdown','arrowup'].includes(key)){e.preventDefault();e.stopImmediatePropagation();choose(e.target);return;}
    if(['f1','f3','f5','f6','f7','f11','f12'].includes(key)||modifier&&['l','t','n','w','p','s','o','j','h','u','r','+','-','=','0'].includes(key)||e.altKey&&['arrowleft','arrowright','home'].includes(key)||modifier&&key==='a'&&!inputTarget(e)){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  document.addEventListener('pointerdown',e=>{if(e.target instanceof HTMLSelectElement){e.preventDefault();}},{capture:true});
  document.addEventListener('mousedown',e=>{if(e.target instanceof HTMLSelectElement)e.preventDefault();},true);
  document.addEventListener('click',e=>{
    if(!(e.target instanceof Element))return;
    if(e.target instanceof HTMLSelectElement){e.preventDefault();e.stopImmediatePropagation();choose(e.target);return;}
    const file=e.target.closest('input[type="file"]')||e.target.closest('label')?.querySelector('input[type="file"]');
    if(file){e.preventDefault();e.stopImmediatePropagation();message(text('Import from another device','Importeren vanaf een ander apparaat'),text('Open TuneBox on your computer to choose and upload a file.','Open TuneBox op je computer om een bestand te kiezen en te uploaden.'));return;}
    const anchor=e.target.closest('a[href]');if(!anchor)return;
    const url=new URL(anchor.getAttribute('href'),location.href);
    if(anchor.hasAttribute('download')||url.origin!==location.origin||!['http:','https:'].includes(url.protocol)){
      e.preventDefault();e.stopImmediatePropagation();handoff(url.href,anchor.hasAttribute('download'));return;
    }
    if(url.pathname.startsWith('/docs/')){
      e.preventDefault();e.stopImmediatePropagation();
      if(/\.(?:md|txt|html?)$/i.test(url.pathname)||url.pathname.endsWith('/'))guide(url.href);else handoff(url.href,true);
      return;
    }
    if(anchor.target==='_blank')anchor.removeAttribute('target');
  },true);
  document.addEventListener('drop',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
  document.addEventListener('dragover',stop,true);
  window.open=(url)=>{if(url)handoff(String(url));return null;};
  window.print=()=>message(text('Print from another device','Afdrukken vanaf een ander apparaat'),text('Open TuneBox on your computer to print.','Open TuneBox op je computer om af te drukken.'));
  window.alert=value=>message(text('TuneBox message','TuneBox-melding'),String(value));
  window.confirm=value=>{message(text('Action needs confirmation','Actie vereist bevestiging'),String(value));return false;};
  window.prompt=value=>{message(text('Use TuneBox settings','Gebruik TuneBox-instellingen'),String(value));return null;};
  function protect(node){
    if(!(node instanceof Element))return;
    const nodes=[node,...node.querySelectorAll('form,input,textarea,img,video,[title]')];
    for(const e of nodes){
      if(e.tagName==='FORM'){e.noValidate=true;e.autocomplete='off';}
      if(['INPUT','TEXTAREA'].includes(e.tagName)){e.setAttribute('autocomplete','off');e.setAttribute('autocorrect','off');e.setAttribute('autocapitalize','off');e.setAttribute('spellcheck','false');}
      if(e.tagName==='IMG')e.draggable=false;
      if(e.tagName==='VIDEO'){e.disablePictureInPicture=true;e.disableRemotePlayback=true;e.setAttribute('controlsList','nodownload noremoteplayback nofullscreen');}
      if(e.hasAttribute('title')){if(!e.hasAttribute('aria-label'))e.setAttribute('aria-label',e.getAttribute('title'));e.removeAttribute('title');}
    }
  }
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)protect(node);}).observe(root,{childList:true,subtree:true});
  protect(root);
})();
