export const defaultAppearance={hue:267,accent:'#ae96f0',motion:true,smooth:true};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||min));
export function luminance(hex){const channels=hex.replace('#','').match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function safeAccent(value){if(!/^#[\da-f]{6}$/i.test(value||''))return defaultAppearance.accent;let hex=value;for(let n=0;n<24&&contrast(hex,'#201a2d')<4.5;n++){hex='#'+hex.slice(1).match(/../g).map(c=>Math.round(parseInt(c,16)*.88+255*.12).toString(16).padStart(2,'0')).join('');}return hex;}
export function normalizeAppearance(value={}){return{hue:clamp(value.hue??267,0,360),accent:safeAccent(value.accent||defaultAppearance.accent),motion:value.motion!==false,smooth:value.smooth!==false};}
export function applyAppearance(value){const settings=normalizeAppearance(value),style=document.documentElement.style;style.setProperty('--theme-hue',settings.hue);style.setProperty('--accent',settings.accent);style.setProperty('--accent-ink',contrast(settings.accent,'#15111e')>=4.5?'#15111e':'#fff');document.documentElement.dataset.motion=String(settings.motion);document.documentElement.dataset.smooth=String(settings.smooth);return settings;}
export function appearanceForm(value){const s=normalizeAppearance(value);return `<section class="panel appearance-panel"><h2>Цвет и движение</h2><p>Тёмная фиолетовая тема. Яркость фона и текста сохраняется автоматически, акцент корректируется до читаемого контраста.</p><form id="appearance-form"><div class="appearance-controls"><div class="field"><label for="appearance-hue">Оттенок фона</label><input id="appearance-hue" type="range" min="0" max="360" value="${s.hue}"></div><div class="field"><label for="appearance-accent">Акцент</label><input id="appearance-accent" type="color" value="${s.accent}"></div></div><label class="layout-checkbox"><input id="appearance-motion" type="checkbox" ${s.motion?'checked':''}>Анимация фона</label><label class="layout-checkbox"><input id="appearance-smooth" type="checkbox" ${s.smooth?'checked':''}>Плавная прокрутка с инерцией</label><div class="modal-footer"><button type="button" class="btn" id="appearance-reset">По умолчанию</button><button type="submit" class="btn btn-primary">Сохранить</button></div></form></section>`;}

export function installSmoothScroll(){
  let target=null,current=0,frame=0,last=0,scroller=null,writing=false;
  const root=()=>document.scrollingElement;
  function cancel(){if(frame)cancelAnimationFrame(frame);frame=0;target=null;scroller=null;}
  function tick(now){if(!scroller||target===null)return;const dt=Math.min(32,now-last||16);last=now;current+=(target-current)*(1-Math.exp(-dt/85));writing=true;scroller.scrollTop=current;writing=false;if(Math.abs(target-current)<.45){scroller.scrollTop=target;cancel();}else frame=requestAnimationFrame(tick);}
  document.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||document.documentElement.dataset.smooth==='false'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    if(event.target.closest('.office-viewport,input,textarea,[contenteditable],.custom-select-popover'))return;
    // Preserve native touchpad inertia: smooth only discrete mouse-wheel steps.
    if(event.deltaMode===0&&Math.abs(event.deltaY)<36)return;
    let el=event.target.closest?.('.modal,.office-detail,.office-seat-list,.sidebar');if(!el||el.scrollHeight<=el.clientHeight)el=root();
    if(document.body.classList.contains('scroll-locked')&&el===root())return;
    const delta=event.deltaY*(event.deltaMode===1?28:event.deltaMode===2?el.clientHeight:1),max=Math.max(0,el.scrollHeight-el.clientHeight);
    const base=el===scroller&&target!==null?target:el.scrollTop,next=Math.max(0,Math.min(max,base+delta));if(next===base)return;event.preventDefault();
    if(scroller!==el){cancel();scroller=el;current=el.scrollTop;}target=next;if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
  },{passive:false});
  document.addEventListener('pointerdown',cancel,true);document.addEventListener('touchstart',cancel,{passive:true});document.addEventListener('keydown',event=>{if(['Escape','Home','End','PageUp','PageDown','ArrowUp','ArrowDown',' '].includes(event.key))cancel();});window.addEventListener('hashchange',cancel);
  document.addEventListener('scroll',event=>{const el=event.target===document?root():event.target;if(scroller===el&&!writing&&Math.abs(el.scrollTop-current)>3)cancel();},true);
}
