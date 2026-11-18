'use strict';

const $ = id => document.getElementById(id);
const data = JSON.parse($('desk-data').textContent);
const names = {initial:'初治', relapse:'复发 / 难治', mixed:'多场景'};
const metrics = {mPFS:'中位 PFS',mOS:'中位 OS',mDOR:'中位 DOR',PFS_HR:'PFS 风险比',PFS_4Y:'4 年 PFS 率'};
const studies = data.studies.map(s => ({...s, ...data.sample.studies.find(r => r.id === s.nct)}));
const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateValue = s => String(s ?? '').replace(/\bESTIMATED\b/g,'预计').replace(/\bACTUAL\b/g,'实际');
const empty = s => '<p class="empty">'+safe(s)+'</p>';
const link = (url, title) => typeof url === 'string' && /^https:\/\//.test(url) ? '<a href="'+safe(url)+'" target="_blank" rel="noopener">'+safe(title)+' ↗</a>' : '';
const options = (id, rows, preferred) => {
  $(id).innerHTML = rows.map(([key,label]) => '<option value="'+safe(key)+'">'+safe(label)+'</option>').join('');
  if (rows.some(([key])=>key===preferred)) $(id).value = preferred;
};
const table = (heads, rows, label) => '<div class="scroll" tabindex="0" aria-label="'+safe(label)+'"><table><thead><tr>'+heads.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(c=>'<tr><th scope="row">'+c[0]+'</th>'+c.slice(1).map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';

function activate() {
  const name = location.hash.slice(1);
  const view = document.querySelector('[data-view][id="'+(['readouts','evidence','regulatory','impact','coverage'].includes(name)?name:'radar')+'"]');
  document.querySelectorAll('[data-view]').forEach(el => { el.hidden = el !== view; });
  document.querySelectorAll('nav a').forEach(a => {
    if (a.hash === '#'+view.id) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',activate);
activate();

const readouts = studies.flatMap(s => s.readouts ?? []);
$('registry-date').innerHTML = '最近成功检查<strong>'+safe(data.checked)+'</strong>';
$('stats').innerHTML = [[studies.length,'登记监测研究','#radar'],[data.events.length,'登记字段变更','registry.html'],[readouts.length,'已关联队列读出','#readouts']].map(([n,label,href])=>'<a href="'+href+'"><strong>'+n+'</strong><span>'+label+' →</span></a>').join('');
$('changes').innerHTML = data.events.map(e => '<a class="change" href="events/'+safe(e.id)+'.html"><small>'+safe(e.nct)+' · '+safe(e.posted_date)+'</small><strong>'+safe(e.field)+'</strong><span>'+safe(dateValue(e.before))+' → '+safe(dateValue(e.after))+'</span></a>').join('') || empty('本批次未发现已核对的登记字段变化。');
options('scene',[['','全部场景'],...Object.entries(names)]);
options('drug',[['','全部药物'],...[...new Set(studies.flatMap(s=>s.drugs ?? []))].sort().map(s=>[s,s])]);

const profiles = {
  acalabrutinib:['BTK','共价 BTK 抑制剂'],
  zanubrutinib:['BTK','共价 BTK 抑制剂'],
  sonrotoclax:['BCL2','BCL2 抑制剂'],
  'tacabrutideg / BGB-16673':['BTK','BTK 降解剂'],
  pirtobrutinib:['BTK','非共价 BTK 抑制剂'],
  venetoclax:['BCL2','BCL2 抑制剂'],
  'brexucabtagene autoleucel':['CD19','CAR-T'],
  'axicabtagene ciloleucel':['CD19','CAR-T'],
};
const facet = (id, items, all) => options(id,[['',all],...[...new Set(items.filter(Boolean))].sort().map(x=>[x,x])]);
facet('sponsor', studies.map(s=>s.lead), '全部申办方');
facet('target', studies.flatMap(s=>(s.drugs ?? []).map(d=>profiles[d]?.[0])), '全部靶点');
facet('mechanism', studies.flatMap(s=>(s.drugs ?? []).map(d=>profiles[d]?.[1])), '全部机制');

const regionLabels = {China:'中国大陆',Taiwan:'台湾','Hong Kong':'香港'};
function studyArchive(study) {
  const protocol = study.protocol;
  if (!protocol) return '';
  const dates = {startDateStruct:'研究开始',primaryCompletionDateStruct:'主要完成',completionDateStruct:'研究完成',studyFirstPostDateStruct:'登记首次发布',lastUpdatePostDateStruct:'快照登记版本'};
  const designRows = [...Object.entries(dates).map(([key,label])=>{
    const row=protocol.dates?.[key];
    return row?.date ? '<li>'+safe(label)+' · '+safe(row.date)+' · '+safe(dateValue(row.type || '待核'))+'</li>' : '';
  }),...(protocol.arms ?? []).map(arm=>'<li>'+safe(arm)+'</li>')].join('');
  const venues = Object.entries(regionLabels).map(([country,label])=>{
    const sites = (study.localSites ?? []).filter(site=>site.country===country);
    if (!sites.length) return '<li>'+safe(label)+' · 快照未列出</li>';
    return '<li>'+safe(label)+' · '+sites.length+' 条记录<ul>'+sites.map(site=>'<li>'+safe(site.city || '城市未列出')+' · '+safe(site.facility === 'Research Site' ? '登记未具名' : site.facility || '机构未列出')+'</li>').join('')+'</ul></li>';
  }).join('');
  return '<details><summary>历史设计与中国大陆、台湾、香港中心</summary><p class="muted">快照 '+safe(data.sample.snapshot)+'。计数为快照记录条数。中心当前状态请回查官方登记。</p><ul>'+designRows+'</ul><ul>'+venues+'</ul></details>';
}
const stageLabels = ['I','I/II','II','III','其他'];
const radarColors = ['#28756c','#3a608e','#97692e','#84704b','#765983','#496f47','#8b5360','#367783'];
const narrowRadar = window.matchMedia('(max-width: 760px)');
let filteredRadarStudies = [];
let sectorMode = !narrowRadar.matches;

function switchRadar(useSector) {
  sectorMode = useSector;
  $('sector-panel').hidden = !useSector;
  $('phase-map').hidden = useSector;
  $('slice-label').hidden = !useSector;
  $('sector-mode').setAttribute('aria-pressed',String(useSector));
  $('list-mode').setAttribute('aria-pressed',String(!useSector));
  if (useSector) sectorRadar(filteredRadarStudies);
}

function sectorRadar(results) {
  const selection = $('radar-slice').value;
  const grouped = new Map();
  results.forEach(s=>{
    const keys = selection==='sponsor'
      ? [s.lead || '申办方待核']
      : [...new Set((s.drugs ?? []).map(d=>profiles[d]?.[selection==='target'?0:1] || '待核'))];
    (keys.length?keys:['待核']).forEach(key=>{
      if (!grouped.has(key)) grouped.set(key,[]);
      grouped.get(key).push(s);
    });
  });
  const sectors = [...grouped.entries()].sort(([a],[b])=>a.localeCompare(b,'zh-CN'));
  const canvas = $('sector-scale');
  const ctx = canvas.getContext('2d');
  ctx.resetTransform();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(2,2);
  ctx.translate(250,250);
  const n = sectors.length;
  if (!n) {
    $('sector-points').innerHTML='';
    $('sector-key').innerHTML=empty('当前筛选无匹配研究。');
    return;
  }
  const occupied = [];
  const points = [];
  const radii = [42,80,119,158,197,234];
  // The v5.5 slot layout spaces points with radial padding and angular separation.
  const pointFor = (a,b,inner,outer) => {
    const mid = (inner+outer)/2;
    const spots = [mid,inner+8,outer-8].flatMap(r=>{
      const pad = Math.min((b-a)/3,12/r);
      const start = a+pad;
      const end = b-pad;
      const count = Math.max(1,Math.floor((end-start)*r/24));
      return [(a+b)/2,...Array.from({length:count},(_,i)=>start+(end-start)*(i+.5)/count)]
        .map(angle=>[Math.cos(angle)*r,Math.sin(angle)*r]);
    });
    return spots.find(([x,y])=>occupied.every(([px,py])=>Math.hypot(px-x,py-y)>=23)) || spots.at(-1);
  };
  sectors.forEach(([label,studiesForSector],i)=>{
    const color = radarColors[i%radarColors.length];
    const arc = 2*Math.PI/n;
    const a = -Math.PI/2+i*arc;
    const b = a+arc;
    for(let j=0;j<stageLabels.length;j++){
      ctx.beginPath();
      ctx.arc(0,0,radii[j+1],a,b);
      ctx.arc(0,0,radii[j],b,a,true);
      ctx.closePath();
      ctx.fillStyle=color+(j%2?'17':'0d');
      ctx.fill();
      ctx.strokeStyle='#d8e3de';
      ctx.lineWidth=1;
      ctx.stroke();
      studiesForSector.filter(s=>(stageLabels.includes(s.phase)?s.phase:'其他')===stageLabels[j]).forEach(s=>{
        const number = studies.indexOf(s)+1;
        const [x,y] = pointFor(a,b,radii[j],radii[j+1]);
        occupied.push([x,y]);
        points.push('<button type="button" style="left:'+((250+x)/5)+'%;top:'+((250+y)/5)+'%;--point-color:'+color+'" data-open-study="'+safe(s.nct)+'" aria-label="'+safe(s.name+' · '+s.nct+' · '+label)+'" title="'+safe(s.name+' · '+s.nct)+'">'+number+'</button>');
      });
    }
  });
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.font='bold 19px sans-serif';
  ctx.fillStyle='#183f35';
  ctx.fillText('MCL',0,-6);
  ctx.font='12px sans-serif';
  ctx.fillText(results.length+' 项研究',0,14);
  $('sector-points').innerHTML=points.join('');
  $('sector-key').innerHTML='<p class="sector-rings">由内向外 · I → I/II → II → III → 其他</p>'+sectors.map(([label,items],i)=>
    '<section class="sector-group"><h3><i style="--point-color:'+radarColors[i%radarColors.length]+'"></i>'+safe(label)+'</h3>'+items.map(s=>
      '<button type="button" data-open-study="'+safe(s.nct)+'"><span>'+(studies.indexOf(s)+1)+'</span><strong>'+safe(s.name)+'</strong><small>'+safe(s.primaryDisplayId===s.nct || !s.primaryDisplayId ? s.nct : s.primaryDisplayId+' / '+s.nct)+'</small></button>'
    ).join('')+'</section>').join('')+'<p class="muted">点或研究编号可打开详情。环内坐标用于排布，同一研究可能属于多个切片。</p>';
}
$('sector-mode').onclick=()=>switchRadar(true);
$('list-mode').onclick=()=>switchRadar(false);
$('radar-slice').onchange=()=>sectorRadar(filteredRadarStudies);

function phaseMap(results) {
  const phases = ['I','I/II','II','III'];
  const groups = [...Object.entries(names),['unknown','待归类']];
  const cells = groups.map(([key,label])=>{
    const row = results.filter(s=>(names[s.scene] ? s.scene : 'unknown')===key);
    if (!row.length) return '';
    const bins = [...phases, '其他'].map(phase=>row.filter(s=>(phases.includes(s.phase) ? s.phase : '其他') === phase));
    return '<div class="radar-lane"><strong>'+safe(label)+'</strong><div class="radar-lane-points">'+bins.map((bin,i)=>bin.length?
      '<div class="radar-bin"><small>'+safe((phases[i] || '其他')+' 期')+'</small>'+bin.map(s=>'<button type="button" data-open-study="'+safe(s.nct)+'"><i></i>'+safe(s.name)+'</button>').join('')+'</div>':'').join('')+'</div></div>';
  }).join('');
  $('phase-map').innerHTML = cells || empty('当前筛选无匹配研究。');
}
function radar() {
  const query = $('search').value.trim().toLowerCase();
  const scene = $('scene').value;
  const region = $('region').value;
  const drug = $('drug').value;
  const sponsor = $('sponsor').value;
  const target = $('target').value;
  const mechanism = $('mechanism').value;
  const results = studies.filter(s=>[s.nct,s.name,s.lead,s.protocolCode,s.primaryDisplayId,...(s.drugs ?? [])].join(' ').toLowerCase().includes(query)
    && (!scene || s.scene === scene) && (!region || s.siteScope === region || s.regions?.[region] > 0)
    && (!sponsor || s.lead === sponsor)
    && (!(drug || target || mechanism) || s.drugs?.some(d=>(!drug || d===drug) && (!target || profiles[d]?.[0]===target) && (!mechanism || profiles[d]?.[1]===mechanism))));
  filteredRadarStudies = results;
  phaseMap(results);
  if (sectorMode) sectorRadar(results);
  $('study-table').innerHTML = results.length ? results.map(s=>{
    const events = data.events.filter(e=>e.nct===s.nct);
    const n = s.readouts?.length ?? 0;
    const enrollment = s.protocol?.enrollment;
    const outcomes = (s.protocol?.primaryOutcomes ?? []).map(o=>'<li><strong>'+safe(o.measure)+'</strong><span>'+safe(o.timeFrame)+'</span></li>').join('');
    const regions = Object.entries(s.regions ?? {}).map(([k,v])=>({China:'大陆',Taiwan:'台湾','Hong Kong':'香港'}[k])+' '+(v || '未列出')).join(' · ');
    return '<details id="study-'+safe(s.nct)+'" class="study"><summary><span class="study-title"><strong>'+safe(s.name)+'</strong><small>'+safe(s.primaryDisplayId && s.primaryDisplayId!==s.nct ? s.primaryDisplayId+' · '+s.nct : s.nct)+' · '+safe(s.lead)+'</small></span><span class="study-tags"><span>'+safe(s.phase || '期别待核')+'</span><span>'+safe(names[s.scene] || '场景待核')+'</span>'+(events.length?'<span class="updated">'+events.length+' 项变更</span>':'')+'</span></summary><div class="study-body"><p class="muted">当前登记发布 '+safe(s.posted_date)+' · 以下设计与中心取自 '+safe(data.sample.snapshot)+' 历史快照</p><dl><dt>队列</dt><dd>'+safe(s.cohort || '待核')+'</dd><dt>试验药物</dt><dd>'+safe(s.drugs?.join('、') || '待核')+'</dd><dt>对照</dt><dd>'+safe(s.comparator || '待核')+'</dd><dt>入组</dt><dd>'+safe(enrollment?.count ?? '待核')+' '+safe({ACTUAL:'实际',ESTIMATED:'预计'}[enrollment?.type] || '')+'</dd><dt>中心记录</dt><dd>'+safe(regions || '待核')+'</dd></dl>'+(outcomes?'<details><summary>登记主要终点</summary><ul>'+outcomes+'</ul></details>':'')+studyArchive(s)+'<div class="study-links">'+link(s.history_url,'登记历史')+(s.registrations ?? []).map(r=>link(r.url,r.id+({portal:'（官方入口）',search:'（官方检索）'}[r.linkKind] || ''))).join('')+(n?'<button type="button" class="plain" data-read="'+safe(s.nct)+'">查看 '+n+' 次队列读出 →</button>':'<span class="muted">暂无已关联读出</span>')+'</div></div></details>';
  }).join('') : empty('未找到匹配的研究。');
}
const radarFilters = ['search','scene','region','drug','target','sponsor','mechanism'];
radarFilters.forEach(id=>$(id).addEventListener(id==='search'?'input':'change',radar));
radar();

document.querySelector('.radar-map').open = !narrowRadar.matches;
switchRadar(sectorMode);
document.getElementById('radar').addEventListener('click', e=>{
  const nct = e.target.closest('[data-open-study]')?.dataset.openStudy;
  if (!nct) return;
  let target = $('study-'+nct);
  if (!target) {
    radarFilters.forEach(id=>{$(id).value='';});
    $('focus-choice').value='';
    $('focus-name').value='';
    radar();
    target=$('study-'+nct);
  }
  if (!target) return;
  target.open=true;
  target.querySelector('summary').focus({preventScroll:true});
  target.scrollIntoView({block:'center'});
});
const focusKey = 'mcl-radar-views-v1';
let savedViews = [];
try {
  const stored = JSON.parse(localStorage.getItem(focusKey));
  if (Array.isArray(stored)) savedViews = stored.filter(v=>v && typeof v.name==='string' && v.filters && typeof v.filters==='object');
} catch {
  $('focus-status').textContent='浏览器存储不可用。';
}
function showFocusOptions(selected) {
  options('focus-choice',[['','团队全景'],...savedViews.map(v=>[v.name,v.name])],selected);
}
function storeFocus(next, selected, notice) {
  try {
    localStorage.setItem(focusKey, JSON.stringify(next));
    savedViews = next;
    showFocusOptions(selected);
    $('focus-status').textContent = notice;
  } catch {
    $('focus-status').textContent='浏览器目前无法保存视图。';
  }
}
showFocusOptions('');
$('focus-choice').onchange=()=>{
  const view = savedViews.find(v=>v.name===$('focus-choice').value);
  radarFilters.forEach(id=>{ $(id).value = typeof view?.filters[id]==='string' ? view.filters[id] : ''; });
  $('focus-name').value = view?.name || '';
  radar();
};
$('focus-save').onclick=()=>{
  const name = $('focus-name').value.trim();
  if (!name) {
    $('focus-status').textContent='请输入关注名称。';
    $('focus-name').focus();
    return;
  }
  const filters = Object.fromEntries(radarFilters.map(id=>[id,$(id).value]));
  storeFocus([...savedViews.filter(v=>v.name!==name),{name,filters}],name,'已保存「'+name+'」。');
};
$('focus-delete').onclick=()=>{
  const name = $('focus-choice').value;
  if (!name) return;
  storeFocus(savedViews.filter(v=>v.name!==name),'','已删除「'+name+'」。');
  $('focus-choice').onchange();
};

options('read-study', studies.map(s=>[s.nct,s.name]),'NCT02601313');
const currentStudy = () => studies.find(s=>s.nct===$('read-study').value);
const cohortRows = () => (currentStudy().readouts ?? []).filter(r=>r.cohortId===$('read-cohort').value);
function chooseStudy() {
  options('read-cohort',[...new Map((currentStudy().readouts ?? []).map(r=>[r.cohortId,r.cohort]))]);
  chooseCohort();
}
function chooseCohort() {
  options('read-analysis',[...new Map(cohortRows().flatMap(r=>r.analyses.map(a=>[a.id,a.label])))], 'overall');
  chooseAnalysis();
}
function chooseAnalysis() {
  const endpoints = [...new Set(cohortRows().flatMap(r=>r.observations.filter(o=>o.analysisId===$('read-analysis').value).map(o=>o.endpoint)))];
  options('read-endpoint',[['','全部终点'],...endpoints.map(e=>[e,metrics[e] || e])]);
  matrix();
}
function pointPlot(rows, endpoint, analysis) {
  if (!endpoint) return '';
  const sets = rows.map(r=>({label:r.label, followup:r.followup, entries:r.observations.filter(o=>o.endpoint===endpoint && o.analysisId===analysis && typeof o.value==='number')}));
  const entries = sets.flatMap(r=>r.entries);
  const units = [...new Set(entries.map(e=>e.unit))];
  if (!entries.length || units.length !== 1) return '';
  const unit = units[0];
  const maximum = unit === '%' ? 100 : Math.ceil(Math.max(...entries.map(o=>o.upper ?? o.value))/5)*5;
  if (maximum <= 0) return '';
  const position = n => 100*n/maximum;
  const plots = sets.map(({label,followup,entries: observations})=>{
    const marks = observations.map(o=>{
      const ci = o.lower!=null && o.upper!=null ? '<i class="interval" style="left:'+position(o.lower)+'%;width:'+position(o.upper-o.lower)+'%"></i>' : '';
      return '<div class="plot-arm"><small>'+safe(o.arm)+'</small><div class="track" title="'+safe(o.value+' '+unit)+'">'+ci+'<i class="point" style="left:'+position(o.value)+'%"></i></div><strong>'+safe(o.value)+'</strong></div>';
    }).join('') || '<span class="muted">未纳入</span>';
    return '<div class="plot-row"><div><strong>'+safe(label)+'</strong><small>'+safe(followup)+'</small></div><div>'+marks+'</div></div>';
  }).join('');
  return '<div class="plot"><h3>'+safe(metrics[endpoint] || endpoint)+' · '+safe(unit)+'</h3>'+plots+'<div class="scale"><span>0</span><span>'+maximum+' '+safe(unit)+'</span></div><p class="muted">圆点表示各次读出的摘要估计，线段表示已收录的双侧 95% CI。各次分母与评估口径见下表。</p></div>';
}
function metricCard(o) {
  return '<div class="metric"><strong>'+safe(o.value ?? '待核')+' '+safe(o.unit)+'</strong><small>'+safe(o.arm)+'</small><small>'+safe(o.lower!=null?'95% CI '+o.lower+'–'+(o.upper ?? ({NE:'NE',NR:'NR'}[o.upperStatus] || '待核')):'CI 未纳入')+'</small><small>'+safe(o.analysisSet)+' · N='+safe(o.denominator ?? '待核')+' · '+safe(o.assessor || '评估者待核')+'</small></div>';
}
function matrix() {
  const rows = cohortRows();
  ['read-cohort','read-analysis','read-endpoint'].forEach(id=>{$(id).disabled = !rows.length;});
  if (!rows.length) {
    $('matrix').innerHTML=empty('该研究暂无已关联读出。可从研究雷达核对登记。');
    return;
  }
  const analysis = $('read-analysis').value;
  const selected = $('read-endpoint').value;
  const endpoints = [...new Set(rows.flatMap(r=>r.observations.filter(o=>o.analysisId===analysis).map(o=>o.endpoint)))].filter(e=>!selected || e===selected);
  const cells = [
    ['人群与分析集', ...rows.map(r=>{ const a=r.analyses.find(x=>x.id===analysis); return a?safe(a.population)+'<small>'+safe(a.analysisSet)+'</small>':empty('未纳入该分析'); })],
    ['随访与截止', ...rows.map(r=>safe(r.followup)+'<small>数据截止 '+safe(r.cutoff)+'</small>')],
    ...endpoints.map(e=>[safe(metrics[e] || e), ...rows.map(r=>{
      const hits = r.observations.filter(o=>o.endpoint===e && o.analysisId===analysis);
      return hits.map(metricCard).join('') || '<span class="muted">未纳入</span>';
    })]),
    ['分析说明', ...rows.map(r=>safe(r.analyses.find(a=>a.id===analysis)?.summary || r.boundary || '待复核'))],
    ['发表材料', ...rows.map(r=>r.materials.map(m=>link(m.url,m.label || '论文')+' '+link(m.indexUrl,'PubMed')).join(' '))],
  ];
  $('matrix').innerHTML='<div class="panel-title"><h2>'+safe(currentStudy().name)+'</h2><span>'+rows.length+' 次读出</span></div>'+pointPlot(rows,selected,analysis)+table(['终点 / 口径',...rows.map(r=>safe(r.label)+'<small>'+safe(r.period)+'</small>')],cells,'队列各次读出矩阵');
}
$('read-study').onchange=chooseStudy;
$('read-cohort').onchange=chooseCohort;
$('read-analysis').onchange=chooseAnalysis;
$('read-endpoint').onchange=matrix;
chooseStudy();
$('study-table').addEventListener('click',e=>{
  if (!e.target.dataset.read) return;
  $('read-study').value=e.target.dataset.read;
  chooseStudy();
  switchComparison(false);
  location.hash='readouts';
});
function switchComparison(cross) {
  $('long-view').hidden = cross;
  $('cross-view').hidden = !cross;
  $('long-mode').setAttribute('aria-pressed',String(!cross));
  $('cross-mode').setAttribute('aria-pressed',String(cross));
}
$('long-mode').onclick=()=>switchComparison(false);
$('cross-mode').onclick=()=>switchComparison(true);

function crossSelection(side) {
  const study = studies.find(s=>s.nct===$('cross-'+side+'-study').value);
  const readout = study?.readouts?.find(r=>r.id===$('cross-'+side+'-readout').value);
  const analysis = readout?.analyses.find(a=>a.id===$('cross-'+side+'-analysis').value);
  return {study,readout,analysis};
}
function compareEndpoints() {
  const keys = ['a','b'].flatMap(side=>{
    const {readout,analysis} = crossSelection(side);
    return (readout?.observations ?? []).filter(o=>o.analysisId===analysis?.id).map(o=>o.endpoint);
  });
  options('cross-endpoint',[...new Set(keys)].map(k=>[k,metrics[k] || k]),$('cross-endpoint').value || 'ORR');
  drawComparison();
}
function drawComparison() {
  const key = $('cross-endpoint').value;
  const selections = ['a','b'].map(crossSelection);
  const observed = selections.map(({readout,analysis})=>(readout?.observations ?? []).filter(o=>o.analysisId===analysis?.id && o.endpoint===key));
  const units = new Set(observed.flatMap(obs=>obs.map(o=>o.unit)));
  const warning = units.size>1 ? '两侧单位不同，需分别解读。' : observed.some(x=>!x.length) ? '至少一侧未收录此终点。' : '请核对人群、随访和评估口径再解读差异。';
  const rows = [
    ['队列', ...selections.map(({readout})=>safe(readout?.cohort || '暂无已关联读出'))],
    ['分析范围与分母口径', ...selections.map(({analysis})=>safe(analysis?.label || '未纳入')+'<small>'+safe(analysis?.population)+' · '+safe(analysis?.analysisSet)+'</small>')],
    ['干预与对照', ...selections.map(({readout})=>safe(readout?.comparator || '未纳入'))],
    ['既往暴露', ...selections.map(({readout})=>safe(readout?.exposure || '未纳入'))],
    ['发表 / 随访 / 数据截止', ...selections.map(({readout})=>safe(readout?.period || '未纳入')+'<small>'+safe(readout?.followup)+' · 截止 '+safe(readout?.cutoff || '未记录')+'</small>')],
    [safe(metrics[key] || key || '终点'), ...observed.map(list=>list.map(metricCard).join('') || '<span class="muted">未纳入</span>')],
    ['原始材料', ...selections.map(({readout})=>(readout?.materials ?? []).map(m=>link(m.url,m.label || '论文')+' '+link(m.indexUrl,'PubMed')).join(' ') || '未纳入')],
  ];
  $('cross-result').innerHTML='<p class="empty" role="status">'+safe(warning)+'</p>'+table(['证据口径',...selections.map(({study,readout})=>safe(study?.name || '选择研究')+'<small>'+safe(readout?.label)+'</small>')],rows,'跨研究证据对照');
}
function chooseCross(side) {
  const prefix = 'cross-'+side;
  const studyControl = $(prefix+'-study');
  const readoutControl = $(prefix+'-readout');
  const analysisControl = $(prefix+'-analysis');
  const selectAnalysis = ()=>{
    const {readout} = crossSelection(side);
    options(prefix+'-analysis',(readout?.analyses ?? []).map(a=>[a.id,a.label]),'overall');
    analysisControl.disabled = !readout;
    compareEndpoints();
  };
  const selectReadout = ()=>{
    const {study} = crossSelection(side);
    options(prefix+'-readout',(study?.readouts ?? []).map(r=>[r.id,r.label+' · '+r.period]));
    readoutControl.disabled = !study?.readouts?.length;
    selectAnalysis();
  };
  options(prefix+'-study',studies.map(s=>[s.nct,s.name]),side==='a'?'NCT02601313':'NCT03740529');
  studyControl.onchange=selectReadout;
  readoutControl.onchange=selectAnalysis;
  analysisControl.onchange=compareEndpoints;
  selectReadout();
}
['a','b'].forEach(chooseCross);
$('cross-endpoint').onchange=drawComparison;

$('copy').onclick=async ()=>{
  try {
    await navigator.clipboard.writeText($('handoff-text').value);
    $('copy-status').textContent='已复制';
  } catch {
    $('handoff-text').closest('details').open=true;
    $('handoff-text').select();
    $('copy-status').textContent='请复制选中的文字';
  }
};

$('historical').innerHTML = readouts.map(r=>'<article class="source-row"><div><strong>'+safe(studies.find(s=>s.readouts?.includes(r)).name)+' · '+safe(r.label)+'</strong><small>'+safe(r.period)+' · '+safe(r.analysisSet)+'</small></div><div>'+r.materials.map(m=>link(m.url,m.label)+' '+link(m.indexUrl,'PubMed')).join(' ')+'</div></article>').join('');
const sourceNames = {pubmed:'PubMed',ash:'ASH',eha:'EHA',asco:'ASCO'};
const statuses = {ok:'已检查',healthy:'已检查',success:'已检查',available:'可用',degraded:'覆盖受限',error:'检查失败',blocked:'访问受限',partial:'部分覆盖',stale:'快照待更新',unavailable:'暂无可用数据',not_checked:'待检查'};
const regulatoryStages = {
  federal_register:'美国联邦公报',
  meeting_notice:'会议公告', briefing_document:'会议审评材料', transcript:'会议实录',
  minutes:'会议纪要', vote:'咨询投票', final_decision:'正式决定',
  final_decision_letter_candidate:'决定信线索 · 待核对', accelerated_approval:'加速批准',
  accelerated_approval_withdrawn:'加速批准撤回', accelerated_approval_pending:'加速批准待验证',
  sponsor_reported_action:'申办方公开披露',
};
const labelStatus = v => statuses[v] || v || '待检查';
async function load(path) {
  try {
    const response = await fetch(path);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
function cards(container, items, defaultEmpty, row) {
  $(container).innerHTML = items?.length ? '<div class="source-grid">'+items.map(row).join('')+'</div>' : '<div class="panel">'+empty(defaultEmpty)+'</div>';
}
function publishedCard(item, metadata, extra) {
  return '<article class="panel item"><small>'+safe(metadata)+'</small><h3>'+safe(item.title)+'</h3>'+(extra || '')+'<div>'+link(item.url,'回查原始材料')+'</div></article>';
}
function sourceInfo(label, s) {
  return [safe(label),safe(labelStatus(s.status)),safe(s.last_success_at || s.checked_at || '待核'),safe([s.scope,s.message,s.count!=null?s.count+' 条':null].filter(Boolean).join(' · '))+(s.url?' '+link(s.url,'来源入口'):'')];
}
Promise.all([load('literature.json'),load('regulatory.json')]).then(([lit,reg])=>{
  let kinds = [['','全部材料']];
  const papers = lit?.items ?? [];
  if (papers.length) {
    const kindLabels = {paper:'论文',publication:'论文',pubmed:'论文',conference:'会议',abstract:'会议摘要',meeting_abstract:'会议摘要'};
    kinds = [...kinds,...[...new Set(papers.map(x=>x.kind).filter(Boolean))].map(k=>[k,kindLabels[k] || k])];
    $('papers').before(Object.assign(document.createElement('div'),{className:'filters',innerHTML:'<label>材料类型<select id="paper-kind"></select></label>'}));
    options('paper-kind', kinds);
    $('paper-kind').onchange = drawPapers;
  }
  function drawPapers() {
    const kind = $('paper-kind')?.value;
    cards('papers',papers.filter(x=>!kind || x.kind===kind),
      lit ? '本批次暂无可展示的论文或会议条目。请查看来源覆盖。' : '暂无公开增量快照。下方保留已关联的历史论文。',
      i=>publishedCard(i,[sourceNames[i.source],i.published_at || '公开日期待核',i.data_cutoff?'数据截止 '+i.data_cutoff:'',i.review_status==='awaiting_review'?'待复核':i.review_status].filter(Boolean).join(' · '),
        (i.trial_ids?.length?'<p class="muted">'+safe(i.trial_ids.join(' · '))+'</p>':'')+(i.abstract ? '<details><summary>查看摘要</summary><p>'+safe(i.abstract)+'</p></details>' : '')));
  }
  drawPapers();
  const projectCases = (lit?.cases ?? [])
    .filter(row => row.review_status === 'primary_source_checked' && row.id !== 'ash:2026:6')
    .sort((a, b) => b.discovered_at.localeCompare(a.discovered_at));
  for (const row of projectCases) {
    const caseLink = document.createElement('p');
    const anchor = document.createElement('a');
    anchor.className = 'more';
    anchor.href = '#impact';
    anchor.textContent = row.title + ' · 查看项目评估 →';
    caseLink.append(anchor);
    $('papers').before(caseLink);
  }
  cards('fda',reg?.events,'暂无公开监管快照。',i=>publishedCard(i,[i.date,regulatoryStages[i.stage] || i.stage,i.status].filter(Boolean).join(' · '),'<p>'+safe(i.summary)+'</p>'+(i.locator?'<p class="muted">材料定位 '+safe(i.locator)+'</p>':'')+(i.vote?'<p>'+safe(typeof i.vote==='string'?i.vote:JSON.stringify(i.vote))+'</p>':'')+((i.official_pdf || i.guidance_url)?'<p>'+link(i.official_pdf,'联邦公报 PDF')+' '+link(i.guidance_url,'FDA 指南')+'</p>':'')));
  const rows = [
    sourceInfo('ClinicalTrials.gov',{status:'ok',checked_at:data.checked,scope:studies.length+' 项固定监测研究',url:'https://clinicaltrials.gov/'}),
    sourceInfo('v5.5 历史样本',{status:'available',checked_at:data.sample.snapshot,scope:'中心和设计取自登记快照；读出逐项关联原始材料'}),
    ...Object.entries(sourceNames).map(([k,name])=>sourceInfo(name,lit?.sources?.[k] ?? {})),
    ...(reg?.sources ?? [{name:'FDA'}]).map(s=>sourceInfo(s.name,s)),
  ];
  $('health').innerHTML=table(['来源','状态','最近成功 / 检查','覆盖与出处'],rows,'公开来源与覆盖');
});
