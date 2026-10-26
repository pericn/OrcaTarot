
import { IMG } from './images.js';
import { DECK, MAJOR_NUM, dsum, toMajor } from './deck.js';
import { compose, whenLoaded } from './share.js';
import { hydrateCardImages } from './card-images.js';
import { icon, spreadIcon } from './icons.js';

/* ---------- 主题 ---------- */
const root=document.documentElement, themeBtn=document.getElementById('themeBtn');
const th=localStorage.getItem('lx-theme');
root.dataset.theme=(th==='light'||th==='dark')?th:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
function paintTheme(){
  const dark=root.dataset.theme==='dark';
  themeBtn.innerHTML=icon(dark?'sun':'moon');
  themeBtn.setAttribute('aria-label',dark?'切换浅色主题':'切换深色主题');
  document.querySelector('meta[name="theme-color"]').content=dark?'#19213d':'#fcfcfa';
}
paintTheme();
themeBtn.onclick=()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem('lx-theme',root.dataset.theme);paintTheme()};
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',e=>{if(!localStorage.getItem('lx-theme')){root.dataset.theme=e.matches?'dark':'light';paintTheme()}});

/* ---------- 体感反馈 ---------- */
function buzz(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}
function pulse(b){b.classList.remove('pulse');void b.offsetWidth;b.classList.add('pulse');}

/* ---------- 偏好 ---------- */
const SPREADS={'1':{name:'单牌阵',n:1},'2':{name:'双牌阵',n:2},
               '3':{name:'三张牌阵',n:3},'bday':{name:'生日牌阵',n:5}};
function readPrefs(){try{return JSON.parse(localStorage.getItem('lx-prefs')||'{}')}catch{return {}}}
const prefs=Object.assign({rev:false,minor:true,spread:'3',bday:null},
  readPrefs());
function savePrefs(){localStorage.setItem('lx-prefs',JSON.stringify(
  {rev:tRev.checked,minor:tMinor.checked,spread,bday}));}

/* ---------- 元素 ---------- */
const tRev=document.getElementById('tRev'), tMinor=document.getElementById('tMinor');
const drawSection=document.getElementById('draw'), revealSection=document.getElementById('reveal');
const slotsEl=document.getElementById('slots'), fanPrompt=document.getElementById('fanPrompt');
const fanWrap=document.getElementById('fanWrap'), fanTrack=document.getElementById('fanTrack');
const fanMid=document.getElementById('fanMid'), fanzone=document.getElementById('fanzone');
const bdayEmpty=document.getElementById('bdayEmpty');
const spreadInd=document.getElementById('spreadInd'), spreadName=document.getElementById('spreadName');
const spreadOv=document.getElementById('spreadOv'), spreadBd=document.getElementById('spreadBd');
const sp3Sub=document.getElementById('sp3Sub');
const bdayRow=document.getElementById('bdayRow'), bdayHead=document.getElementById('bdayHead');
const bdayForm=document.getElementById('bdayForm');
const bY=document.getElementById('bY'), bM=document.getElementById('bM'), bD=document.getElementById('bD');
const bStart=document.getElementById('bStart'), bErr=document.getElementById('bErr');
const bdayGo=document.getElementById('bdayGo');
const rvPrompt=document.getElementById('rvPrompt'), rvRow=document.getElementById('rvRow');
const rvHidden=document.getElementById('rvHidden'), hCard=document.getElementById('hCard');
const reShuffle=document.getElementById('reShuffle'), shareBtn=document.getElementById('shareBtn');
const shareOv=document.getElementById('shareOv'), shareImg=document.getElementById('shareImg');
const historyOv=document.getElementById('historyOv'), historyList=document.getElementById('historyList');
const historyBtn=document.getElementById('historyBtn'), historyClose=document.getElementById('historyClose');
const historyClear=document.getElementById('historyClear'), historyCount=document.getElementById('historyCount');

/* ---------- 状态 ---------- */
let spread=Object.hasOwn(SPREADS,prefs.spread)?prefs.spread:'3';
let count=SPREADS[spread].n;
let picks=[], hidden=null, busy=false, recorded=false;
let readingId=null, readingTs=Date.now(), drawRevision=0;
let bday=prefs.bday||null;
let fanPool=[], fanCards=[], fanRaf=0, tsx=0, tsy=0, fanMoved=false;
let rvCards=[];
let fanVisible=[];

tRev.checked=!!prefs.rev;
tMinor.checked=prefs.minor!==false;
syncSpreadIcon();

function syncSpreadIcon(){
  document.getElementById('spreadIcon').innerHTML=spreadIcon(spread);
  spreadName.textContent=spread==='bday'?'生日牌阵':'';
  spreadInd.setAttribute('aria-label','选择牌阵：'+SPREADS[spread].name);
}
const rvExtra=document.getElementById('rvExtra');
/* ---------- S1 牌位 ---------- */
function renderSlots(){
  slotsEl.setAttribute('data-n',count);
  let html='';
  for(let i=0;i<count;i++){
    const p=picks[i];
    if(p){
      html+='<div class="slot done"><div class="slotcard"><img src="'+IMG.BACK+'" alt="" draggable="false"></div></div>';
    }else{
      html+='<div class="slot'+(i===picks.length?' next':'')+'"><div class="ph"><span>'+['I','II','III','IIII','V'][i]+'</span></div></div>';
    }
  }
  slotsEl.innerHTML=html;
}
function markNext(){
  Array.prototype.forEach.call(slotsEl.children,(s,i)=>
    s.classList.toggle('next',i===picks.length));
}

/* ---------- 扇形牌阵 ---------- */
function renderFan(){
  fanPool=(tMinor.checked?DECK:DECK.filter(c=>c.major)).slice();
  for(let i=fanPool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    const t=fanPool[i];fanPool[i]=fanPool[j];fanPool[j]=t;
  }
  fanTrack.innerHTML=fanPool.map((c,i)=>
    '<button type="button" class="fcard" aria-label="选择第 '+(i+1)+' 张牌" data-key="'+c.key+'" data-i="'+i+'" style="left:'+(i*STEP)+'px">'
    +'<div class="fcard-i">'
    +'<img src="'+IMG.BACK+'" alt="" draggable="false"></div></button>').join('');
  fanCards=Array.prototype.slice.call(fanTrack.children);
  fanTrack.style.width=((fanPool.length-1)*STEP+CARD_W)+'px';
  // Commit the shorter track before assigning scrollLeft; the old 78-card
  // scroll offset otherwise survives the first switch to 22 cards.
  fanVisible=[];
  fanWrap.scrollLeft=Math.max(0,(fanPool.length-1)*STEP/2+CARD_W/2-fanWrap.clientWidth/2);
  updateFan();
}
const STEP=52, CARD_W=100;
function updateFan(){
  if(drawSection.hidden||spread==='bday')return;
  const W=fanWrap.clientWidth, sl=fanWrap.scrollLeft, c=sl+W/2;
  const first=Math.max(0,Math.floor((sl-90)/STEP));
  const last=Math.min(fanPool.length-1,Math.ceil((sl+W+90)/STEP));
  const dipMax=Math.max(48,fanWrap.clientHeight*0.30);
  for(const i of fanVisible){if(i<first||i>last)fanCards[i].style.visibility='hidden';}
  fanVisible=[];
  for(let i=first;i<=last;i++){
    fanVisible.push(i);
    const el=fanCards[i]; if(!el)continue;
    const dx=i*STEP+CARD_W/2-c;
    const rot=Math.max(-42,Math.min(42,dx*.06));
    const dip=Math.min(dipMax,dx*dx/5200);
    const sc=Math.max(.45,1-Math.abs(dx)/1400);
    el.style.visibility=el.classList.contains('gone')?'hidden':'visible';
    el.style.transform='translate3d(0,'+dip.toFixed(1)+'px,0) rotate('+rot.toFixed(2)+'deg) scale('+sc.toFixed(3)+')';
  }
}
fanWrap.addEventListener('scroll',()=>{
  if(fanRaf)return;
  fanRaf=requestAnimationFrame(()=>{fanRaf=0;updateFan();});
},{passive:true});
fanWrap.addEventListener('touchstart',e=>{
  tsx=e.touches[0].clientX;tsy=e.touches[0].clientY;fanMoved=false;
},{passive:true});
fanWrap.addEventListener('touchmove',e=>{
  if(!fanMoved&&(Math.abs(e.touches[0].clientX-tsx)>9||Math.abs(e.touches[0].clientY-tsy)>9))fanMoved=true;
},{passive:true});
fanWrap.addEventListener('click',e=>{
  if(fanMoved||busy)return;
  const c=e.target.closest('.fcard');
  if(!c)return;
  pickFan(parseInt(c.dataset.i,10));
});
fanWrap.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const current=e.target.closest('.fcard');if(!current)return;
  e.preventDefault();
  const direction=e.key==='ArrowLeft'||e.key==='End'?-1:1;
  let index=e.key==='Home'?0:e.key==='End'?fanCards.length-1:+current.dataset.i+direction;
  while(index>=0&&index<fanCards.length&&fanCards[index].classList.contains('gone'))index+=direction;
  if(index<0||index>=fanCards.length)return;
  fanWrap.scrollLeft=Math.max(0,index*STEP+CARD_W/2-fanWrap.clientWidth/2);
  updateFan();fanCards[index].focus({preventScroll:true});
});
window.addEventListener('resize',()=>{
  if(drawSection.hidden||spread==='bday')return;
  fanTrack.style.width=((fanPool.length-1)*STEP+CARD_W)+'px';
  updateFan();
});

/* ---------- 抽牌：牌飞进牌位 ---------- */
function flyToSlot(fEl,fr,slotEl,done){
  const sr=slotEl.getBoundingClientRect();
  const ghost=document.createElement('div');ghost.className='flyghost';
  const img=document.createElement('img');img.src=IMG.BACK;img.alt='';ghost.append(img);
  ghost.style.cssText='left:'+fr.left+'px;top:'+fr.top+'px;width:'+fr.width+'px;height:'+fr.height+'px';
  document.body.appendChild(ghost);
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  // Only transform/opacity animate: left/top/width/height used to force layout
  // on every animation frame, alongside dozens of shadowed fan cards.
  const animation=ghost.animate([
    {transform:'none',opacity:1},
    {transform:'translate('+ (sr.left-fr.left)+'px,'+(sr.top-fr.top)+'px) scale('+(sr.width/fr.width)+','+(sr.height/fr.height)+')',opacity:.9}
  ],{duration:reduced?0:280,easing:'cubic-bezier(.3,.7,.3,1)',fill:'forwards'});
  animation.finished.then(()=>{ghost.remove();done();}).catch(()=>ghost.remove());
}
function pickFan(i){
  if(busy||picks.length>=count)return;
  const fEl=fanCards[i];
  if(!fEl||fEl.classList.contains('gone'))return;
  const slotEl=slotsEl.children[picks.length];
  if(!slotEl)return;
  busy=true;const revision=drawRevision;
  const fr=fEl.getBoundingClientRect();   // 在隐藏之前记录飞牌起点
  fEl.classList.add('gone');fEl.style.visibility='hidden';
  picks.push({...fanPool[i],rev:tRev.checked&&Math.random()<0.4,flipped:false});
  whenLoaded(IMG[fanPool[i].key],{retry:true});
  if(picks.length===count){const c=computeHidden();if(c)whenLoaded(IMG[c.key],{retry:true});}
  markNext();
  updatePrompt();
  flyToSlot(fEl,fr,slotEl,()=>{
    if(revision!==drawRevision)return;
    busy=false;renderSlots();
    buzz(12);
    if(picks.length===count){buzz([12,50,12]);goReveal();}
  });
}

/* ---------- S1 提示语 ---------- */
function updatePrompt(){
  fanPrompt.textContent=spread==='bday'?'':('已选 '+picks.length+' / '+count);
}

/* ---------- S2 翻牌屏 ---------- */
function frontMarkup(p){
  return '<span class="face front"><img class="'+(p.rev?'rev':'')+'" data-card-src="'+IMG[p.key]+'" alt="'+p.cn+'" draggable="false" hidden>'
    +'<span class="card-image-status" role="status">牌面加载中…</span></span>';
}
function retryMarkup(){return '<button type="button" class="btn image-retry" hidden>重试牌面</button>';}
function cardMarkup(p,i){
  return '<div class="rcard'+(p.rev?' rev':'')+'" data-i="'+i+'">'
    +'<button type="button" class="flip" aria-label="翻开第 '+(i+1)+' 张牌"><span class="flip-inner">'
    +'<span class="face back"><img src="'+IMG.BACK+'" alt="牌背" draggable="false"></span>'
    +frontMarkup(p)
    +'</span></button>'+retryMarkup()+'<div class="rname">'+p.cn+'</div>'
    +(p.rev?'<div class="rrev">逆位</div>':'')+'</div>';
}
function renderReveal(){
  rvRow.dataset.n=String(count);
  rvRow.innerHTML=picks.slice(0,count).map(cardMarkup).join('');
  rvCards=Array.from(rvRow.children);
  hydrateCardImages(rvRow);
  rvRow.classList.add('pre');
  rvExtra.hidden=true;rvExtra.replaceChildren();
  hidden=null;rvHidden.hidden=true;hCard.innerHTML='';
  hCard.classList.remove('flipped','guide');
  shareBtn.hidden=true;
  updateRvPrompt();
}
function goReveal(){
  if(busy||picks.length<count)return;
  renderReveal();
  fanzone.hidden=true;
  drawSection.hidden=true;revealSection.hidden=false;
  rvRow.classList.remove('pre');
  rvRow.children[0]?.classList.add('guide');
  buzz(12);
}
// The wheel at the end of the primary reading (upright or reversed) offers one
// extra card from the remaining pool. A revealed hidden wheel also qualifies.
function syncWheel(){
  revealSection.querySelectorAll('.wheel-action').forEach(b=>b.remove());
  const last=picks[count-1];
  const mainWheel=last?.flipped&&last.key==='M10';
  const hiddenWheel=hidden?.flipped&&hidden.key==='M10';
  if((!mainWheel&&!hiddenWheel)||picks.length>count)return;
  const button=document.createElement('button');button.type='button';
  button.className='btn wheel-action';button.innerHTML=icon('plus')+'再抽一张';
  button.onclick=()=>{
    if(picks.length>count)return;
    const used=new Set(picks.map(p=>p.key));
    const pool=(tMinor.checked?DECK:DECK.filter(c=>c.major)).filter(p=>!used.has(p.key));
    const card=pool[Math.floor(Math.random()*pool.length)];
    if(!card)return;
    picks.push({...card,rev:tRev.checked&&Math.random()<.4,flipped:false,extra:true});
    whenLoaded(IMG[card.key],{retry:true});
    button.remove();
    rvExtra.hidden=false;rvExtra.innerHTML='<div class="rvh-cap">追加牌</div>'+cardMarkup(picks.at(-1),picks.length-1);
    hydrateCardImages(rvExtra);
    rvExtra.querySelector('.rcard').classList.add('guide');
    updateRvPrompt();buzz(12);
  };
  (mainWheel?rvRow.lastElementChild:hCard).append(button);
}
function afterFlip(){
  if(spread==='3'&&picks.slice(0,count).every(p=>p.flipped)&&!hidden)showHidden();
  document.querySelectorAll('.rcard.guide').forEach(g=>g.classList.remove('guide'));
  const next=[...rvRow.children,...(hidden?[hCard]:[]),...rvExtra.querySelectorAll('.rcard')].find(c=>!c.classList.contains('flipped'));
  if(next)next.classList.add('guide');
  syncWheel();updateRvPrompt();
  if(picks.every(p=>p.flipped)&&(!hidden||hidden.flipped)){
    buzz([12,50,12]);
    recordReading();
  }
}
function flipReadingCard(e){
  if(e.target.closest('.wheel-action,.image-retry'))return;
  const c=e.target.closest('.rcard');
  if(!c||c.classList.contains('flipped'))return;
  const p=picks[+c.dataset.i]; if(!p)return;
  c.classList.add('flipped');
  c.querySelector('.flip').setAttribute('aria-label',p.cn+(p.rev?'，逆位':''));
  p.flipped=true;
  buzz(9);
  afterFlip();
}
rvRow.addEventListener('click',flipReadingCard);
rvExtra.addEventListener('click',flipReadingCard);
hCard.addEventListener('click',e=>{
  if(e.target.closest('.wheel-action,.image-retry'))return;
  if(!hidden||hidden.flipped||hCard.classList.contains('flipped'))return;
  hCard.classList.add('flipped');
  hidden.flipped=true;
  hCard.querySelector('button').setAttribute('aria-label',hidden.cn+'，隐藏牌');
  buzz(9);
  afterFlip();
});
function computeHidden(){
  if(spread!=='3')return null;
  if(tMinor.checked)return null;                  // 使用小阿尔卡纳时不算隐藏牌
  if(picks.slice(0,count).some(p=>p.num==null))return null;          // 防御：缺数字的牌无法计算
  let s=0; for(const p of picks.slice(0,count))s+=p.num;
  while(s>21)s=dsum(s);
  return DECK[s];
}
function showHidden(){
  const c=computeHidden();
  if(!c){updateRvPrompt();return;}
  hidden={...c,flipped:false,hidden:true};
  hCard.innerHTML='<button type="button" class="flip" aria-label="翻开隐藏牌"><span class="flip-inner">'
    +'<span class="face back"><img src="'+IMG.BACK+'" alt="牌背" draggable="false"></span>'
    +frontMarkup(hidden)
    +'</span></button>'+retryMarkup()+'<div class="rname">'+hidden.cn+'</div>';
  hydrateCardImages(hCard);
  rvHidden.hidden=false;
  setTimeout(()=>{if(hidden&&!hidden.flipped)hCard.classList.add('guide');},420);
  updateRvPrompt();
}
function updateRvPrompt(){
  const mainAll=picks.length>0&&picks.every(p=>p.flipped);
  if(mainAll&&shareBtn.hidden){
    shareBtn.hidden=false;
    shareBtn.classList.remove('appear');void shareBtn.offsetWidth;shareBtn.classList.add('appear');
  }
  rvPrompt.textContent='';
  shareBtn.hidden=!mainAll;
}

/* ---------- 牌阵选择面板 ---------- */
function syncRows(){
  document.querySelectorAll('.sp-row').forEach(r=>
    r.classList.toggle('on',r.dataset.s===spread));
}
function openSheet(expandBday){
  syncRows();
  sp3Sub.textContent=tMinor.checked?'3 张':'3 张 · 含隐藏牌';
  spreadOv.hidden=false;
  if(expandBday){
    bdayForm.hidden=false;
    if(bday){bY.value=bday.y;bM.value=bday.m;bD.value=bday.d;}
    bErr.hidden=true;
    [bY,bM,bD].forEach(i=>i.classList.remove('bad'));
  }else{
    bdayForm.hidden=true;
  }
}
function closeSheet(){spreadOv.hidden=true;}
spreadInd.onclick=()=>openSheet(false);
document.getElementById('spreadClose').onclick=closeSheet;
bdayGo.onclick=()=>openSheet(true);
spreadBd.onclick=closeSheet;
document.querySelectorAll('.sp-head').forEach(h=>{
  h.onclick=()=>{
    const s=h.parentElement.dataset.s;
    if(s==='bday'){
      bdayForm.hidden=!bdayForm.hidden;
      if(!bdayForm.hidden&&bday){bY.value=bday.y;bM.value=bday.m;bD.value=bday.d;}
      return;
    }
    if(s===spread){closeSheet();return;}
    spread=s; count=SPREADS[s].n;
    syncSpreadIcon();
    savePrefs();
    syncRows();
    closeSheet();
    resetDraw();
    buzz(15);
  };
});
tRev.onchange=()=>{savePrefs();resetDraw();};
tMinor.onchange=()=>{savePrefs();resetDraw();};

/* ---------- 生日牌阵 ---------- */
bStart.onclick=()=>{
  const y=parseInt(bY.value,10), m=parseInt(bM.value,10), d=parseInt(bD.value,10);
  const nowY=new Date().getFullYear();
  const bad=[];
  if(!(y>=1900&&y<=nowY))bad.push(bY);
  if(!(m>=1&&m<=12))bad.push(bM);
  const dim=(y>=1900&&y<=nowY&&m>=1&&m<=12)?new Date(y,m,0).getDate():31;
  if(!(d>=1&&d<=dim))bad.push(bD);
  [bY,bM,bD].forEach(i=>i.classList.remove('bad'));
  if(bad.length){
    bad.forEach(i=>i.classList.add('bad'));
    bErr.hidden=false;
    bErr.textContent='请填写有效的出生日期';
    return;
  }
  bErr.hidden=true;
  bday={y,m,d};
  spread='bday'; count=5;
  syncSpreadIcon();
  savePrefs();
  drawRevision++;readingId=null;readingTs=Date.now();
  const yc=toMajor(dsum(y));      // 年份牌：各位相加，<=21 分界
  const mc=DECK[m];              // 月份牌：1-12 直接对应
  const dc=toMajor(d);           // 日子牌：>21 则各位再相加
  let k=dsum(y)+dsum(m)+dsum(d); // karma 牌：年月日全部数字加到个位数
  while(k>9)k=dsum(k);
  const kc=DECK[k];
  const fc=toMajor(dsum(nowY));  // 流年牌：今年年份各位相加，<=21 分界
  picks=[yc,mc,dc,kc,fc].map(c=>({...c,rev:false,flipped:false}));
  picks.forEach(c=>whenLoaded(IMG[c.key],{retry:true}));
  closeSheet();
  renderSlots();
  updatePrompt();
  goReveal();
};

/* ---------- 重新洗牌 ---------- */
reShuffle.onclick=()=>{pulse(reShuffle);buzz(20);resetDraw();};
function resetDraw(){
  drawRevision++;readingId=null;readingTs=Date.now();recorded=false;fanzone.hidden=false;drawSection.hidden=false;revealSection.hidden=true;
  document.querySelectorAll('.flyghost').forEach(el=>el.remove());
  picks=[]; hidden=null; busy=false;
  renderSlots();
  renderReveal();
  if(spread==='bday'){
    fanWrap.hidden=true; fanMid.hidden=true; bdayEmpty.hidden=false;
  }else{
    fanWrap.hidden=false; fanMid.hidden=false; bdayEmpty.hidden=true;
    renderFan();
  }
  updatePrompt();
  drawSection.hidden=false;
  revealSection.hidden=true;
}

/* ---------- 历史抽卡记录（localStorage，iOS webapp 持久化） ---------- */
const HKEY='lx-history', HMAX=100;
function loadHistory(){
  try{const a=JSON.parse(localStorage.getItem(HKEY)||'[]');return Array.isArray(a)?a:[];}
  catch(e){return [];}
}
function saveHistory(list){
  try{localStorage.setItem(HKEY,JSON.stringify(list));}catch(e){}
}
function addHistory(rec){
  const list=loadHistory();
  list.unshift(rec);
  while(list.length>HMAX)list.pop();
  saveHistory(list);
}
function orderedCards(){
  return [...picks.slice(0,count).filter(p=>p.flipped),...(hidden?.flipped?[hidden]:[]),...picks.slice(count).filter(p=>p.flipped)];
}
function orderSavedCards(cards){
  return [...cards.filter(c=>!c.hid&&!c.hidden&&!c.extra),...cards.filter(c=>c.hid||c.hidden),...cards.filter(c=>c.extra&&!c.hid&&!c.hidden)];
}
/* 一次完整揭示 = 一条记录（含隐藏牌，若已翻开） */
function recordReading(){

  const cards=orderedCards().map(p=>({key:p.key,cn:p.cn,rev:!!p.rev,...(p.extra?{extra:true}:{}),...(p.hidden?{hid:true}:{})}));
  if(!readingId)readingId=Date.now()+'-'+Math.random().toString(36).slice(2,7);
  const rec={id:readingId,ts:readingTs,spread,cards};
  const list=loadHistory(),index=list.findIndex(r=>r.id===readingId);
  if(index>=0){list[index]=rec;saveHistory(list)}else addHistory(rec);
  recorded=true;
}
const SPREAD_COLOR={'1':'var(--ink)','2':'var(--ink)','3':'var(--ink)','bday':'var(--ink)'};
function fmtTs(ts){
  const d=new Date(ts);
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 '+p(d.getHours())+':'+p(d.getMinutes());
}
let disposeHistoryImages=()=>{};
function renderHistory(){
  disposeHistoryImages();
  const list=loadHistory();
  historyCount.textContent=list.length?'共 '+list.length+' 条 · 存于本机':'';
  historyClear.hidden=list.length===0;
  if(!list.length){
    historyList.innerHTML='<div class="hd-empty"><p class="hd-e-orn"></p>'
      +'<p class="hd-e-t">尚 无 记 录</p>'
      +'<p class="hd-e-s">完成一次抽卡后自动存档</p></div>';
    return;
  }
  historyList.innerHTML=list.map(r=>{
    const cards=orderSavedCards(r.cards);
    const thumbs=cards.map(c=>
      '<div class="hd-thumb'+(c.hid||c.hidden?' hid':'')+'"><img class="'+(c.rev?'rev':'')+'" data-card-src="'
      +(IMG[c.key]||IMG.BACK)+'" alt="'+c.cn+'" loading="lazy" decoding="async" draggable="false"></div>').join('');
    const names=cards.map(c=>(c.hid||c.hidden?'隐藏 ':c.extra?'追加 ':'')+c.cn+(c.rev?'（逆）':'')).join(' · ');
    return '<div class="hd-item" data-id="'+r.id+'">'
      +'<div class="hd-meta"><span class="hd-date">'+fmtTs(r.ts)+'</span>'
      +'<span class="hd-spread" style="color:'+(SPREAD_COLOR[r.spread]||'var(--ink-soft)')+'">'
      +(SPREADS[r.spread]?SPREADS[r.spread].name:r.spread)+'</span>'
      +'<button class="hd-share" data-share="'+r.id+'" aria-label="重新分享此页">'+icon('share')+'</button>'
      +'<button class="hd-del" data-del="'+r.id+'" aria-label="删除此条">'+icon('trash')+'</button></div>'
      +'<div class="hd-cards">'+thumbs+'</div>'
      +'<div class="hd-names">'+names+'</div></div>';
  }).join('');
  disposeHistoryImages=hydrateCardImages(historyList);
}
historyList.addEventListener('click',e=>{
  const sh=e.target.closest('[data-share]');
  if(sh){
    const rec=loadHistory().find(r=>r.id===sh.dataset.share);
    if(rec)reshareRecord(rec);
    return;
  }
  const b=e.target.closest('[data-del]');
  if(!b)return;
  saveHistory(loadHistory().filter(r=>r.id!==b.dataset.del));
  renderHistory();
  buzz(8);
});
/* 重新分享历史记录：用存档数据原样重绘分享卡（日期取抽卡当日） */
async function reshareRecord(rec){
  try{
    const jobs=rec.cards.map(c=>IMG[c.key]?whenLoaded(IMG[c.key],{retry:true}):Promise.resolve());
    await Promise.all(jobs);
    await document.fonts.load('16px OrcaWoodblock');
    await document.fonts.ready;
    shareImg.src=compose(orderSavedCards(rec.cards),rec.ts).toDataURL('image/png');
    shareOv.dataset.returnTo="history";
    setHistory(false);
    shareOv.hidden=false;
    buzz(9);
  }catch(e){}
}
historyClear.onclick=()=>{
  if(!loadHistory().length)return;
  if(!confirm('清空本机的全部抽牌记录？此操作无法撤销。'))return;
  saveHistory([]);
  renderHistory();
  buzz(12);
};
function setHistory(open){
  historyOv.hidden=!open;
  document.body.classList.toggle('history-open',open);
  document.getElementById('drawBtn').setAttribute('aria-current',open?'false':'page');
  historyBtn.setAttribute('aria-current',open?'page':'false');
}
historyBtn.onclick=()=>{renderHistory();setHistory(true);buzz(9);};
historyClose.onclick=()=>{setHistory(false);buzz(6);};

/* ---------- 添加到主屏幕引导（iOS Safari 首次；#guide 或点牌匾3次可随时预览） ---------- */
const GKEY='lx-guide-done', VKEY='lx-visited';
const guideOv=document.getElementById('guideOv');
function isIosSafari(){
  const ua=navigator.userAgent;
  const ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const safari=/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
  return ios&&safari&&!navigator.standalone;
}
function injectGuideImgs(){
  document.getElementById('gdImgMenu').src=IMG.ios_menu;
  document.getElementById('gdImgShot').src=IMG.ios_share;
  document.getElementById('gdImgWebapp').src=IMG.ios_webapp;
}
function closeGuide(){
  guideOv.hidden=true;
  try{localStorage.setItem(GKEY,'1');}catch(e){}
}
function openGuide(){injectGuideImgs();guideOv.hidden=false;}
document.getElementById('guideOk').onclick=closeGuide;
document.getElementById('guideClose').onclick=closeGuide;
guideOv.addEventListener('click',e=>{if(e.target===guideOv)closeGuide();});
function initGuide(force){
  const forced=force||/guide/.test(location.hash+location.search);
  if(!forced&&!isIosSafari())return;
  try{
    if(!forced&&localStorage.getItem(GKEY))return;
    injectGuideImgs();
    guideOv.hidden=false;
  }catch(e){}
}
initGuide();
/* 地址栏补 #guide 即时预览，无需刷新 */
window.addEventListener('hashchange',()=>{if(/guide/.test(location.hash))openGuide();});
/* 测试手势：连续点牌匾 3 次，随时预览引导 */
(function(){
  let taps=0,timer=null;
  document.querySelector('.brand').addEventListener('click',()=>{
    taps++;
    clearTimeout(timer);
    timer=setTimeout(()=>taps=0,700);
    if(taps>=3){taps=0;openGuide();buzz(9);}
  });
})();
/* 换牌阵入口：本机首次到访时轻浮一下，之后安静 */
try{
  if(!localStorage.getItem(VKEY)){
    localStorage.setItem(VKEY,'1');
    requestAnimationFrame(()=>spreadInd.classList.add('bounce'));
  }
}catch(e){}

/* ---------- 分享截图 ---------- */
async function shareNow(){
  try{
    const cards=orderedCards();
    const jobs=cards.map(c=>whenLoaded(IMG[c.key],{retry:true}));
    await Promise.all(jobs);
    await document.fonts.load('16px OrcaWoodblock');
    await document.fonts.ready;
    shareImg.src=compose(cards,readingTs).toDataURL('image/png');
    shareOv.dataset.returnTo="draw";
    shareOv.hidden=false;
    buzz(9);
  }catch(e){console.error("分享失败",e)}
}
shareBtn.onclick=shareNow;
function closeShare(){shareOv.hidden=true;if(shareOv.dataset.returnTo==='history')setHistory(true);}
document.getElementById('shareClose').onclick=closeShare;
shareOv.addEventListener('click',e=>{if(e.target===shareOv)closeShare();});

resetDraw();

// Navigation keeps the current reading intact. Dialogs return focus to the
// opener, and Escape is the same action as each visible back control.
document.getElementById('drawBtn').onclick=()=>{setHistory(false);};
window.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(!guideOv.hidden)closeGuide();else if(!shareOv.hidden)closeShare();
  else if(!spreadOv.hidden)closeSheet();else setHistory(false);
});
for(const overlay of [spreadOv,shareOv,historyOv,guideOv]){
  let returnFocus=null;
  new MutationObserver(()=>{
    if(!overlay.hidden){returnFocus=document.activeElement;overlay.querySelector('button,input')?.focus();}
    else if(returnFocus?.isConnected)returnFocus.focus();
  }).observe(overlay,{attributes:true,attributeFilter:['hidden']});
  overlay.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const controls=[...overlay.querySelectorAll('button,input'),...(overlay===historyOv?document.querySelectorAll('.main-nav button'):[])];
    const els=controls.filter(el=>!el.disabled&&el.getClientRects().length);
    const first=els[0],last=els.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
  });
}
