/* ---------- 牌组（马赛 78 张，罗马数字编号） ---------- */
/* 马赛传统记法：愚者无数字，VIII 正义、VIIII 隐者、XI 力量、XIIII 节制、XVIIII 太阳 */
const MAJOR_NUM=['0','I','II','III','IIII','V','VI','VII','VIII','VIIII','X','XI','XII',
                 'XIII','XIIII','XV','XVI','XVII','XVIII','XVIIII','XX','XXI'];
const MAJORS=['愚者','魔术师','女祭司','皇后','皇帝','教皇','恋人','战车','正义','隐者',
              '命运之轮','力量','吊人','死亡','节制','恶魔','高塔','星星','月亮','太阳','审判','世界'];
const SUITS={coin:'钱币',cup:'圣杯',sword:'宝剑',wand:'权杖'};
const RANKS={'01':'一','02':'二','03':'三','04':'四','05':'五','06':'六',
             '07':'七','08':'八','09':'九','10':'十','page':'侍从','knight':'骑士','queen':'皇后','king':'国王'};
const PIP_NUM={'01':'I','02':'II','03':'III','04':'IIII','05':'V','06':'VI',
               '07':'VII','08':'VIII','09':'VIIII','10':'X'};
const DECK=MAJORS.map((cn,i)=>({
  key:'M'+String(i).padStart(2,'0'),
  cn:i===0?'愚者':(i===13?'XIII':MAJOR_NUM[i]+' · '+cn),  // 愚者不标数字；13 号死亡牌只留编号
  num:i, major:true
}));
Object.keys(SUITS).forEach(s=>{
  Object.keys(RANKS).forEach(r=>{
    const pip=parseInt(r,10);
    const cn=pip?(PIP_NUM[r]+' · '+SUITS[s]):(SUITS[s]+' '+RANKS[r]);  // 数字牌罗马编号，宫廷牌无编号
    DECK.push({key:s+'_'+r,cn,num:pip||null,major:false});
  });
});
const dsum=n=>String(n).split('').reduce((a,c)=>a+ +c,0);
function toMajor(n){while(n>21)n=dsum(n);return DECK[n];}   // <=21 分界，超过则各位再相加


export { DECK, MAJOR_NUM, dsum, toMajor };
