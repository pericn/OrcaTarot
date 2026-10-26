import { IMG } from './images.js';
import { whenLoaded, getLoadedImage } from './card-images.js';

function diamond(g,x,y,r,color){
  g.save();g.fillStyle=color;g.translate(x,y);g.rotate(Math.PI/4);
  g.fillRect(-r/2,-r/2,r,r);g.restore();
}
function drawLogo(g,cx,y,w,ink){
  g.fillStyle=ink;g.font='400 48px OrcaWoodblock';g.textAlign='center';
  g.fillText('鲸灵匣',cx,y+35);
}
function drawCard(g,src,rev,x,y,w,h,bg,ink){
  const img=getLoadedImage(src), r=9;
  g.save();
  g.beginPath();
  g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r);
  g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y+h,r);
  g.arcTo(x,y,x+w,y,r);
  g.closePath();g.clip();
  g.fillStyle=bg;g.fillRect(x,y,w,h);
  if(img&&img.complete&&img.naturalWidth){
    g.save();
    g.translate(x+w/2,y+h/2);          // 原点移到牌中心
    if(rev)g.rotate(Math.PI);          // 逆位绕牌中心旋转 180°
    const ir=img.naturalWidth/img.naturalHeight, cr=w/h;
    let dw,dh;
    if(ir>cr){dw=w;dh=w/ir;}else{dh=h;dw=h*ir;}
    g.drawImage(img,-dw/2,-dh/2,dw,dh);   // 以牌中心为原点绘制
    g.restore();
  }else{
    g.fillStyle=ink;g.font='14px OrcaWoodblock,serif';g.textAlign='center';
    g.fillText('牌面暂不可用',x+w/2,y+h/2,w-12);
  }
  g.restore();
  g.strokeStyle=ink;g.lineWidth=1.6;
  g.beginPath();
  g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r);
  g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y+h,r);
  g.arcTo(x,y,x+w,y,r);
  g.closePath();g.stroke();
}
/* 生成分享卡：cards 为已翻开的牌（含隐藏牌 hid），ts 为抽卡时间戳（重新分享历史时传入） */
function compose(cards,ts){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const PAPER=dark?'#19213d':'#fcfcfa', PAPER2=PAPER;
  const INK=dark?'#f4f3ed':'#252834', SOFT=dark?'#d1d7e6':'#505665';
  const LINE=dark?'#8391ae':'#a0a9b8';
  /* 四色版墨：赭石 / 茜草 / 靛蓝 / 苔绿 */
  const GOLD=dark?'#d9a94e':'#b8802a', MADDER=dark?'#c1553a':'#96351f';
  const INDIGO=dark?'#7d95c2':'#3c4f74', MOSS=dark?'#8a9660':'#5f6b3c';
  const CARDBG='#ffffff';
  const W=750, M=62, PAD=32;
  const SERIF='OrcaWoodblock,serif';
  const shown=cards||[];
  const n=shown.length;
  const cols=Math.min(n,3), rows=Math.ceil(n/3);
  const gap=n===1?0:25;
  const cardW=n===1?300:Math.floor((W-2*M-(cols-1)*gap)/cols);
  const cardH=Math.round(cardW/0.5305);
  const small=cardW<140;
  const nameF=small?'400 17px '+SERIF:'400 20px '+SERIF;
  const rowH=cardH+100;
  const areaH=n===0?150:rows*rowH;
  const headH=140, footH=70;
  const H=M+headH+PAD+areaH+PAD+footH+M;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const g=cv.getContext('2d');
  const bg=g.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,PAPER);bg.addColorStop(1,PAPER2);
  g.fillStyle=bg;g.fillRect(0,0,W,H);
  g.save();g.globalAlpha=.05;g.fillStyle=INK;
  for(let i=0;i<1600;i++)g.fillRect(Math.random()*W,Math.random()*H,1.2,1.2);
  g.restore();
  g.strokeStyle=INK;g.lineWidth=2.5;g.strokeRect(M-30,M-30,W-2*(M-30),H-2*(M-30));
  g.strokeStyle=LINE;g.lineWidth=1;g.strokeRect(M-18,M-18,W-2*(M-18),H-2*(M-18));
  diamond(g,M-30,M-30,7,GOLD);diamond(g,W-(M-30),M-30,7,MADDER);
  diamond(g,M-30,H-(M-30),7,MOSS);diamond(g,W-(M-30),H-(M-30),7,INDIGO);
  g.textAlign='center';g.textBaseline='middle';
  /* 全页和分享图使用同一套刻本字体 */
  drawLogo(g,W/2,M+8,160,INK);
  g.fillStyle=SOFT;g.font='12px '+SERIF;
  g.fillText('T A R O T   D E   M A R S E I L L E',W/2,M+96);
  const d=ts?new Date(ts):new Date();
  g.fillStyle=SOFT;g.font='15px '+SERIF;
  g.fillText(d.getFullYear()+' 年 '+(d.getMonth()+1)+' 月 '+d.getDate()+' 日',W/2,M+120);
  const y0=M+headH+PAD;
  if(n===0){
    g.fillStyle=SOFT;g.font='15px '+SERIF;
    g.fillText('   尚 未 抽 牌   ',W/2,y0+75);
  }else{
    const totalW=cols*cardW+(cols-1)*gap;
    let x=(W-totalW)/2;
    shown.forEach((c,i)=>{
      const inRow=Math.min(cols,n-Math.floor(i/cols)*cols);
      x=(W-(inRow*cardW+(inRow-1)*gap))/2+(i%cols)*(cardW+gap);
      const cy=y0+Math.floor(i/cols)*rowH;
      if(c.hid||c.hidden||c.extra){
        g.fillStyle=SOFT;g.font=small?'12px '+SERIF:'13px '+SERIF;
        g.fillText(c.extra?'追 加 牌':'隐 藏 牌',x+cardW/2,cy-16);
      }
      drawCard(g,IMG[c.key]||IMG.BACK,!!c.rev,x,cy,cardW,cardH,CARDBG,INK);
      g.fillStyle=SOFT;g.font=nameF;
      g.fillText(c.cn,x+cardW/2,cy+cardH+29,cardW+10);
      if(c.rev){
        g.fillStyle=SOFT;g.font=small?'12px '+SERIF:'14px '+SERIF;
        g.fillText('逆 位',x+cardW/2,cy+cardH+(small?51:55));
      }
      x+=cardW+gap;
    });
  }
  g.fillStyle=GOLD;g.font='15px '+SERIF;
  diamond(g,W/2,H-M-footH/2+6,8,INK);
  return cv;
}

export { compose, whenLoaded };
