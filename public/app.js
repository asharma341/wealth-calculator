(function(){
  'use strict';
  const FM=window.FinanceMath;
  const symbols={USD:'$',CAD:'CA$',INR:'₹',EUR:'€',GBP:'£'};
  const state={workflow:'project',strategy:'sip',last:null};
  const $=id=>document.getElementById(id);
  const els={
    market:$('market-track'),theme:$('theme-toggle'),themeLabel:$('theme-label'),
    workflow:[...document.querySelectorAll('[data-workflow]')],strategy:[...document.querySelectorAll('[data-strategy]')],strategyRow:$('strategy-row'),
    target:$('target'),monthly:$('monthly'),lump:$('lump'),step:$('step-up'),years:$('years'),rate:$('return-rate'),inflation:$('inflation'),tax:$('tax-rate'),currency:$('currency'),
    low:$('rate-low'),high:$('rate-high'),baseDisplay:$('base-rate-display'),calculate:$('calculate'),error:$('error'),
    results:$('results'),resultKicker:$('result-kicker'),resultTitle:$('result-title'),resultSummary:$('result-summary'),
    labelPrimary:$('label-primary'),subPrimary:$('sub-primary'),statPrimary:$('stat-primary'),statInvested:$('stat-invested'),statGain:$('stat-gain'),statAfterTax:$('stat-after-tax'),statReal:$('stat-real'),
    chart:$('chart'),tooltip:$('chart-tooltip'),scenarioIntro:$('scenario-intro'),scenarioCards:$('scenario-cards'),yearlyBody:$('yearly-body'),
    csv:$('export-csv'),pdf:$('export-pdf'),inputHeading:$('input-heading'),inputCopy:$('input-copy')
  };
  const monthlyField=els.monthly.closest('.field');
  const lumpField=els.lump.closest('.field');
  const stepField=els.step.closest('.field');

  function number(el){return Number(el.value)}
  function compactMoney(value,code=els.currency.value){
    if(!Number.isFinite(value))return '—';
    const symbol=symbols[code]||code+' ';
    const sign=value<0?'-':'';
    const abs=Math.abs(value);
    const locale=code==='INR'?'en-IN':'en-US';
    if(code==='INR'){
      if(abs>=1e7)return sign+symbol+(abs/1e7).toLocaleString(locale,{maximumFractionDigits:2})+' Cr';
      if(abs>=1e5)return sign+symbol+(abs/1e5).toLocaleString(locale,{maximumFractionDigits:2})+' L';
    }
    const tiers=[[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'K']];
    for(const [size,suffix] of tiers)if(abs>=size)return sign+symbol+(abs/size).toLocaleString(locale,{maximumFractionDigits:2})+suffix;
    return sign+symbol+abs.toLocaleString(locale,{maximumFractionDigits:2});
  }
  function fullMoney(value,code=els.currency.value){
    if(!Number.isFinite(value))return '—';
    try{return new Intl.NumberFormat(code==='INR'?'en-IN':'en-US',{style:'currency',currency:code,maximumFractionDigits:0}).format(value)}catch{return code+' '+Math.round(value).toLocaleString()}
  }
  function rawMoney(value,code=els.currency.value){return `${code} ${Number(value).toFixed(2)}`}
  function pct(value){return `${Number(value).toFixed(1)}%`}

  function setTheme(dark){
    document.documentElement.dataset.theme=dark?'dark':'light';
    els.theme.setAttribute('aria-checked',String(dark));
    els.themeLabel.textContent=dark?'Dark':'Light';
    try{localStorage.setItem('compounded-theme',dark?'dark':'light')}catch{}
  }
  let savedTheme='';try{savedTheme=localStorage.getItem('compounded-theme')||''}catch{}
  setTheme(savedTheme?savedTheme==='dark':window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  els.theme.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme!=='dark'));

  function selectButtons(buttons,selected,dataKey){
    buttons.forEach(button=>{
      const active=button.dataset[dataKey]===selected;
      button.classList.toggle('active',active);
      button.setAttribute(dataKey==='workflow'?'aria-selected':'aria-checked',String(active));
    });
  }
  function updateForm(){
    const goal=state.workflow==='goal';
    document.querySelectorAll('.goal-only').forEach(node=>node.classList.toggle('hidden',!goal));
    els.strategyRow.classList.toggle('hidden',goal);
    monthlyField.classList.toggle('hidden',goal||state.strategy==='lump');
    lumpField.classList.toggle('hidden',!goal&&state.strategy==='sip');
    stepField.classList.toggle('hidden',!goal&&state.strategy==='lump');
    els.inputHeading.textContent=goal?'Work backward from your target':'Build your investment plan';
    els.inputCopy.textContent=goal?'Enter the future amount and assumptions. We will solve for the starting monthly SIP.':'Choose how you will contribute.';
    els.calculate.textContent=goal?'Calculate required SIP':'Calculate plan';
  }
  els.workflow.forEach(button=>button.addEventListener('click',()=>{state.workflow=button.dataset.workflow;selectButtons(els.workflow,state.workflow,'workflow');updateForm()}));
  els.strategy.forEach(button=>button.addEventListener('click',()=>{state.strategy=button.dataset.strategy;selectButtons(els.strategy,state.strategy,'strategy');updateForm()}));

  document.querySelectorAll('.benchmark').forEach(button=>button.addEventListener('click',()=>{
    els.rate.value=button.dataset.rate;
    els.baseDisplay.textContent=pct(button.dataset.rate);
    document.querySelectorAll('.benchmark').forEach(item=>item.classList.toggle('selected',item===button));
    els.rate.focus();
  }));
  els.rate.addEventListener('input',()=>{els.baseDisplay.textContent=Number.isFinite(number(els.rate))?pct(number(els.rate)):'—'});
  els.currency.addEventListener('change',()=>{document.querySelectorAll('.currency-symbol').forEach(node=>node.textContent=symbols[els.currency.value]);if(state.last)run(false)});

  function readInputs(rateOverride){
    return {
      years:number(els.years),monthly:state.strategy==='lump'?0:number(els.monthly),lump:state.strategy==='sip'&&state.workflow==='project'?0:number(els.lump),
      stepPercent:state.strategy==='lump'&&state.workflow==='project'?0:number(els.step),annualReturn:rateOverride??number(els.rate),inflationPercent:number(els.inflation),taxPercent:number(els.tax)
    };
  }
  function validate(options){
    if(!Number.isInteger(options.years)||options.years<1||options.years>60)return 'Enter a whole investment period from 1 to 60 years.';
    if(!Number.isFinite(options.annualReturn)||options.annualReturn<=-100)return 'Enter an annual return greater than -100%.';
    if(!Number.isFinite(options.inflationPercent)||options.inflationPercent<0)return 'Inflation cannot be negative.';
    if(!Number.isFinite(options.taxPercent)||options.taxPercent<0||options.taxPercent>100)return 'Tax on gain must be from 0% to 100%.';
    if(!Number.isFinite(options.stepPercent)||options.stepPercent<0||options.stepPercent>100)return 'Annual SIP step-up must be from 0% to 100%.';
    if(state.workflow==='goal'){
      if(!Number.isFinite(number(els.target))||number(els.target)<=0)return 'Enter a future target greater than zero.';
      if(!Number.isFinite(options.lump)||options.lump<0)return 'Opening lump sum cannot be negative.';
    }else{
      if((state.strategy==='sip'||state.strategy==='combined')&&(!Number.isFinite(options.monthly)||options.monthly<=0))return 'Enter a monthly investment greater than zero.';
      if((state.strategy==='lump'||state.strategy==='combined')&&(!Number.isFinite(options.lump)||options.lump<=0))return 'Enter an opening lump sum greater than zero.';
    }
    return '';
  }

  function run(scroll=true){
    try{
      const options=readInputs();
      const error=validate(options);
      if(error){els.error.textContent=error;return}
      els.error.textContent='';
      let plan,requiredMonthly=null;
      if(state.workflow==='goal'){
        const solved=FM.solveMonthly(options,number(els.target));
        requiredMonthly=solved.monthly;plan=solved.plan;
      }else plan=FM.simulate(options);
      const model={workflow:state.workflow,strategy:state.strategy,options,plan,requiredMonthly,target:state.workflow==='goal'?number(els.target):null,currency:els.currency.value};
      state.last=model;
      renderSummary(model);renderChart(plan.rows);renderScenarios(model);renderYearly(plan.rows);
      els.results.classList.remove('hidden');
      if(scroll)els.results.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(error){els.error.textContent=error&&error.message?error.message:'Unable to calculate this plan.'}
  }
  els.calculate.addEventListener('click',()=>run(true));

  function renderSummary(model){
    const {plan,currency}=model;
    if(model.workflow==='goal'){
      els.resultKicker.textContent='Reverse goal calculation';
      els.resultTitle.textContent='A monthly plan for your target';
      els.resultSummary.textContent=`To reach ${fullMoney(model.target,currency)} in ${plan.years} years after the simplified tax estimate, start near ${fullMoney(model.requiredMonthly,currency)} per month and increase it ${pct(plan.stepPercent)} each year.`;
      els.labelPrimary.textContent='Starting monthly SIP';els.subPrimary.textContent='first year; rises with your step-up';els.statPrimary.textContent=compactMoney(model.requiredMonthly,currency);
    }else{
      els.resultKicker.textContent=model.strategy==='combined'?'Lump sum + stepped SIP projection':model.strategy==='lump'?'Lump-sum projection':'Stepped SIP projection';
      els.resultTitle.textContent='Your plan at a glance';
      els.resultSummary.textContent=`A ${plan.years}-year projection at ${pct(plan.rate)} nominal return, ${pct(model.options.inflationPercent)} inflation and ${pct(model.options.taxPercent)} estimated tax on gains.`;
      els.labelPrimary.textContent='Future value';els.subPrimary.textContent='before estimated tax';els.statPrimary.textContent=compactMoney(plan.value,currency);
    }
    els.statInvested.textContent=compactMoney(plan.invested,currency);els.statGain.textContent=compactMoney(plan.gain,currency);els.statAfterTax.textContent=compactMoney(plan.afterTax,currency);els.statReal.textContent=compactMoney(plan.realValue,currency);
  }

  function renderYearly(rows){
    els.yearlyBody.replaceChildren();
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      [row.year,fullMoney(row.monthly),fullMoney(row.added),fullMoney(row.invested),fullMoney(row.growth),fullMoney(row.value),fullMoney(row.realValue)].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.appendChild(td)});
      els.yearlyBody.appendChild(tr);
    });
  }

  function renderScenarios(model){
    const rates=[{name:'Conservative',rate:number(els.low)},{name:'Base',rate:model.options.annualReturn,base:true},{name:'Optimistic',rate:number(els.high)}].filter(item=>Number.isFinite(item.rate)&&item.rate>-100);
    els.scenarioCards.replaceChildren();
    els.scenarioIntro.textContent=model.workflow==='goal'?'Required starting monthly SIP under each return assumption.':'After-tax ending value under each return assumption.';
    rates.forEach(item=>{
      const options=Object.assign({},model.options,{annualReturn:item.rate});
      let value,label;
      if(model.workflow==='goal'){const solved=FM.solveMonthly(options,model.target);value=solved.monthly;label='starting monthly SIP'}
      else{value=FM.simulate(options).afterTax;label='after-tax ending value'}
      const card=document.createElement('article');card.className='scenario-card'+(item.base?' base':'');
      const header=document.createElement('header');const title=document.createElement('h4');title.textContent=item.name;const rate=document.createElement('span');rate.textContent=pct(item.rate);header.append(title,rate);
      const strong=document.createElement('strong');strong.textContent=compactMoney(value,model.currency);const small=document.createElement('small');small.textContent=label;card.append(header,strong,small);els.scenarioCards.appendChild(card);
    });
  }

  function renderChart(rows){
    const W=900,H=360,left=58,right=18,top=20,bottom=42,iw=W-left-right,ih=H-top-bottom;
    const max=Math.max(1,...rows.map(row=>Math.max(row.value,row.invested)));
    const x=index=>left+(rows.length===1?iw:index/(rows.length-1)*iw);
    const y=value=>top+ih-(Math.max(0,value)/max)*ih;
    const path=key=>rows.map((row,index)=>`${index?'L':'M'}${x(index).toFixed(2)},${y(row[key]).toFixed(2)}`).join(' ');
    const area=key=>`${path(key)} L${x(rows.length-1)},${top+ih} L${x(0)},${top+ih} Z`;
    const grid=[0,.25,.5,.75,1].map(f=>`<line class="grid-line" x1="${left}" y1="${top+ih*f}" x2="${W-right}" y2="${top+ih*f}"/><text class="axis-label" x="${left-8}" y="${top+ih*f+4}" text-anchor="end">${escapeXml(shortNumber(max*(1-f)))}</text>`).join('');
    const ticks=[0,.25,.5,.75,1].map(f=>{const index=Math.round((rows.length-1)*f);return `<text class="axis-label" x="${x(index)}" y="${H-12}" text-anchor="middle">Y${rows[index].year}</text>`}).join('');
    const points=rows.map((row,index)=>`<circle class="chart-point" tabindex="0" role="button" aria-label="Year ${row.year}, value ${fullMoney(row.value)}" data-index="${index}" cx="${x(index)}" cy="${y(row.value)}" r="4"/>`).join('');
    els.chart.innerHTML=`${grid}<path class="area-value" d="${area('value')}"/><path class="area-invested" d="${area('invested')}"/><path class="line-invested" d="${path('invested')}"/><path class="line-value" d="${path('value')}"/>${points}${ticks}`;
    els.chart.querySelectorAll('.chart-point').forEach(point=>{
      const show=()=>showTooltip(point,rows[Number(point.dataset.index)]);point.addEventListener('mouseenter',show);point.addEventListener('focus',show);point.addEventListener('mouseleave',hideTooltip);point.addEventListener('blur',hideTooltip);
    });
  }
  function shortNumber(value){const abs=Math.abs(value);if(abs>=1e9)return (value/1e9).toFixed(1)+'B';if(abs>=1e6)return (value/1e6).toFixed(1)+'M';if(abs>=1e3)return (value/1e3).toFixed(0)+'K';return Math.round(value).toString()}
  function escapeXml(text){return String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]))}
  function showTooltip(point,row){const box=els.chart.getBoundingClientRect(),svg=els.chart.viewBox.baseVal;els.tooltip.textContent=`Year ${row.year}: ${fullMoney(row.value)} · invested ${fullMoney(row.invested)}`;els.tooltip.style.left=`${(Number(point.getAttribute('cx'))/svg.width)*box.width}px`;els.tooltip.style.top=`${(Number(point.getAttribute('cy'))/svg.height)*box.height}px`;els.tooltip.classList.remove('hidden')}
  function hideTooltip(){els.tooltip.classList.add('hidden')}

  function tickerSet(items){
    const set=document.createElement('div');set.className='ticker-set';
    items.forEach((item,index)=>{const node=document.createElement('span');node.className='ticker-item';const name=document.createElement('span');name.className='ticker-name';name.textContent=item.label;const price=document.createElement('span');price.className='ticker-price';price.textContent=Number(item.price).toLocaleString('en-US',{minimumFractionDigits:item.decimals,maximumFractionDigits:item.decimals});const change=document.createElement('span');const direction=item.changePercent>0?'up':item.changePercent<0?'down':'flat';change.className=`ticker-change ${direction}`;change.textContent=`${item.changePercent>0?'▲':item.changePercent<0?'▼':'•'} ${Math.abs(item.changePercent).toFixed(2)}%`;node.append(name,price,change);set.appendChild(node);if(index<items.length-1){const dot=document.createElement('span');dot.className='ticker-dot';dot.textContent='•';set.appendChild(dot)}});return set;
  }
  let hasMarketData=false;
  async function loadMarkets(){
    try{const response=await fetch('/api/markets',{headers:{Accept:'application/json'}});if(!response.ok)throw new Error();const payload=await response.json();if(!Array.isArray(payload.markets)||!payload.markets.length)throw new Error();const first=tickerSet(payload.markets),second=first.cloneNode(true);second.setAttribute('aria-hidden','true');els.market.replaceChildren(first,second);els.market.dataset.ready='true';hasMarketData=true}
    catch{if(!hasMarketData){const message=document.createElement('span');message.className='ticker-message';message.textContent='Market prices are temporarily unavailable — retrying automatically.';els.market.replaceChildren(message);els.market.dataset.ready='false'}}
  }

  function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function csvCell(value){const text=String(value);return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text}
  function reportRows(model){
    const meta=[['Compounded Wealth & Goal Planner'],['Workflow',model.workflow==='goal'?'Goal / reverse calculator':'Wealth projection'],['Currency',model.currency],['Years',model.plan.years],['Annual return',model.options.annualReturn+'%'],['Annual SIP step-up',model.options.stepPercent+'%'],['Inflation',model.options.inflationPercent+'%'],['Estimated tax on gain',model.options.taxPercent+'%']];
    if(model.workflow==='goal'){meta.push(['Future target',model.target],['Required starting monthly SIP',model.requiredMonthly])}else meta.push(['Starting monthly SIP',model.plan.monthly]);
    meta.push(['Opening lump sum',model.plan.lump],['Total invested',model.plan.invested],['Future value',model.plan.value],['After-tax value',model.plan.afterTax],['Value in today\'s money',model.plan.realValue],[]);
    const header=['Year','Monthly SIP','Added this year','Total invested','Growth this year','Ending value','After-tax value','Today\'s value'];
    const rows=model.plan.rows.map(row=>[row.year,row.monthly,row.added,row.invested,row.growth,row.value,row.afterTax,row.realValue]);
    return {meta,header,rows};
  }
  els.csv.addEventListener('click',()=>{if(!state.last)return;const report=reportRows(state.last);const lines=[...report.meta,report.header,...report.rows].map(row=>row.map(csvCell).join(','));download('compounded-yearly-plan.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8')});

  function pdfEscape(value){return String(value).replace(/[^\x20-\x7E]/g,'?').replace(/([\\()])/g,'\\$1')}
  function makePdf(lines){
    const pages=[];for(let i=0;i<lines.length;i+=46)pages.push(lines.slice(i,i+46));
    const objects=[];const pageIds=pages.map((_,i)=>4+i*2),contentIds=pages.map((_,i)=>5+i*2);
    objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pages.length} >>`;objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    pages.forEach((page,index)=>{const commands=['BT','/F1 9 Tf','42 760 Td'];page.forEach((line,lineIndex)=>{if(lineIndex)commands.push('0 -15 Td');commands.push(`(${pdfEscape(line)}) Tj`)});commands.push('ET');const stream=commands.join('\n');objects[pageIds[index]]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;objects[contentIds[index]]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`});
    let pdf='%PDF-1.4\n%----\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return pdf;
  }
  els.pdf.addEventListener('click',()=>{
    if(!state.last)return;const model=state.last,report=reportRows(model);const moneyLabels=new Set(['Future target','Required starting monthly SIP','Starting monthly SIP','Opening lump sum','Total invested','Future value','After-tax value',"Value in today's money"]);const lines=['COMPOUNDED - WEALTH & GOAL PLAN',''];report.meta.forEach(row=>{if(row.length)lines.push(`${row[0]}: ${moneyLabels.has(row[0])?rawMoney(row[1],model.currency):row[1]}`);else lines.push('')});lines.push('YEAR | MONTHLY SIP | ADDED | INVESTED | GROWTH | END VALUE | REAL VALUE');report.rows.forEach(row=>lines.push(`${String(row[0]).padStart(4)} | ${rawMoney(row[1],model.currency)} | ${rawMoney(row[2],model.currency)} | ${rawMoney(row[3],model.currency)} | ${rawMoney(row[4],model.currency)} | ${rawMoney(row[5],model.currency)} | ${rawMoney(row[7],model.currency)}`));lines.push('','Estimates use a constant return and simplified tax treatment. Not financial or tax advice.');download('compounded-yearly-plan.pdf',makePdf(lines),'application/pdf');
  });

  updateForm();
  document.querySelectorAll('.currency-symbol').forEach(node=>node.textContent=symbols[els.currency.value]);
  loadMarkets();setInterval(loadMarkets,60000);
})();
