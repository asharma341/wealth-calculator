(function(){
  'use strict';
  const FM=window.FinanceMath;
  const symbols={USD:'$',CAD:'CA$',INR:'₹',EUR:'€',GBP:'£'};
  const state={workflow:'project',strategy:'sip',last:null};
  const $=id=>document.getElementById(id);
  const els={
    market:$('market-track'),theme:$('theme-toggle'),themeLabel:$('theme-label'),
    workflow:[...document.querySelectorAll('[data-workflow]')],strategy:[...document.querySelectorAll('[data-strategy]')],strategyRow:$('strategy-row'),
    target:$('target'),monthly:$('monthly'),lump:$('lump'),step:$('step-up'),years:$('years'),rate:$('return-rate'),inflation:$('inflation'),tax:$('tax-rate'),currency:$('currency'),withdrawalMode:$('withdrawal-mode'),withdrawalRate:$('withdrawal-rate'),
    low:$('rate-low'),high:$('rate-high'),baseDisplay:$('base-rate-display'),calculate:$('calculate'),error:$('error'),
    results:$('results'),resultKicker:$('result-kicker'),resultTitle:$('result-title'),resultSummary:$('result-summary'),
    labelPrimary:$('label-primary'),subPrimary:$('sub-primary'),statPrimary:$('stat-primary'),statInvested:$('stat-invested'),statGain:$('stat-gain'),statAfterTax:$('stat-after-tax'),statReal:$('stat-real'),
    chart:$('chart'),tooltip:$('chart-tooltip'),scenarioIntro:$('scenario-intro'),scenarioCards:$('scenario-cards'),yearlyBody:$('yearly-body'),
    csv:$('export-csv'),pdf:$('export-pdf'),inputHeading:$('input-heading'),inputCopy:$('input-copy'),lumpLabel:$('lump-label'),lumpHelp:$('lump-help'),yearsLabel:$('years-label'),legendSecondary:$('legend-secondary'),legendPrimary:$('legend-primary'),yearlyCopy:$('yearly-copy'),thTwo:$('th-two'),thThree:$('th-three'),thFour:$('th-four'),
    newsGrid:$('news-grid'),newsStatus:$('news-status'),refreshNews:$('refresh-news'),newsFilters:[...document.querySelectorAll('[data-news-filter]')]
  };
  const monthlyField=els.monthly.closest('.field');
  const lumpField=els.lump.closest('.field');
  const stepField=els.step.closest('.field');
  const taxField=els.tax.closest('.field');
  const scenarioSettings=document.querySelector('.scenario-settings');
  const inputsPanel=document.querySelector('.inputs-panel');
  const assumptionPanel=document.querySelector('.assumption-panel');

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
  if(!window.CompoundedCommon){
    let savedTheme='';try{savedTheme=localStorage.getItem('compounded-theme')||''}catch{}
    setTheme(savedTheme?savedTheme==='dark':window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    els.theme.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme!=='dark'));
  }

  function selectButtons(buttons,selected,dataKey){
    buttons.forEach(button=>{
      const active=button.dataset[dataKey]===selected;
      button.classList.toggle('active',active);
      button.setAttribute(dataKey==='workflow'?'aria-selected':'aria-checked',String(active));
    });
  }
  function animateTabChange(){
    [inputsPanel,assumptionPanel].forEach(panel=>{if(!panel)return;panel.classList.remove('tab-refresh');void panel.offsetWidth;panel.classList.add('tab-refresh')});
  }
  function updateForm(){
    const goal=state.workflow==='goal';
    const withdraw=state.workflow==='withdraw';
    document.querySelectorAll('.goal-only').forEach(node=>node.classList.toggle('hidden',!goal));
    document.querySelectorAll('.withdrawal-only').forEach(node=>node.classList.toggle('hidden',!withdraw));
    els.strategyRow.classList.toggle('hidden',goal||withdraw);
    monthlyField.classList.toggle('hidden',goal||withdraw||state.strategy==='lump');
    lumpField.classList.toggle('hidden',!withdraw&&!goal&&state.strategy==='sip');
    stepField.classList.toggle('hidden',withdraw||(!goal&&state.strategy==='lump'));
    taxField.classList.toggle('hidden',withdraw);
    scenarioSettings.classList.remove('hidden');
    els.lumpLabel.textContent=withdraw?'Starting portfolio':'Opening lump sum';
    els.lumpHelp.textContent=withdraw?'amount available at retirement':'invested today';
    els.yearsLabel.textContent=withdraw?'Withdrawal period':'Investment period';
    els.inputHeading.textContent=withdraw?'Test retirement withdrawals':goal?'Work backward from your target':'Build your investment plan';
    els.inputCopy.textContent=withdraw?'Choose how much to withdraw and see how long the portfolio may last.':goal?'Enter the future amount and assumptions. We will solve for the starting monthly SIP.':'Choose how you will contribute.';
    els.calculate.textContent=withdraw?'Calculate withdrawals':goal?'Calculate required SIP':'Calculate plan';
  }
  els.workflow.forEach(button=>button.addEventListener('click',()=>{state.workflow=button.dataset.workflow;selectButtons(els.workflow,state.workflow,'workflow');updateForm();animateTabChange()}));
  els.strategy.forEach(button=>button.addEventListener('click',()=>{state.strategy=button.dataset.strategy;selectButtons(els.strategy,state.strategy,'strategy');updateForm();animateTabChange()}));

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
  function readWithdrawal(rateOverride){
    return {years:number(els.years),startingBalance:number(els.lump),withdrawalRate:number(els.withdrawalRate),mode:els.withdrawalMode.value,annualReturn:rateOverride??number(els.rate),inflationPercent:number(els.inflation)};
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
  function validateWithdrawal(options){
    if(!Number.isInteger(options.years)||options.years<1||options.years>60)return 'Enter a whole withdrawal period from 1 to 60 years.';
    if(!Number.isFinite(options.startingBalance)||options.startingBalance<=0)return 'Enter a starting portfolio greater than zero.';
    if(!Number.isFinite(options.withdrawalRate)||options.withdrawalRate<=0||options.withdrawalRate>25)return 'Enter a withdrawal rate from 0.1% to 25%.';
    if(!Number.isFinite(options.annualReturn)||options.annualReturn<=-100)return 'Enter an annual return greater than -100%.';
    if(!Number.isFinite(options.inflationPercent)||options.inflationPercent<0)return 'Inflation cannot be negative.';
    return '';
  }

  function run(scroll=true){
    try{
      if(state.workflow==='withdraw'){
        const options=readWithdrawal(),error=validateWithdrawal(options);
        if(error){els.error.textContent=error;return}
        els.error.textContent='';
        const plan=FM.simulateWithdrawal(options);
        const model={workflow:'withdraw',options,plan,currency:els.currency.value};
        state.last=model;renderSummary(model);renderChart(plan.rows,model);renderScenarios(model);renderYearly(model);
        els.results.classList.remove('hidden');if(scroll)els.results.scrollIntoView({behavior:'smooth',block:'start'});return;
      }
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
      renderSummary(model);renderChart(plan.rows,model);renderScenarios(model);renderYearly(model);
      els.results.classList.remove('hidden');
      if(scroll)els.results.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(error){els.error.textContent=error&&error.message?error.message:'Unable to calculate this plan.'}
  }
  els.calculate.addEventListener('click',()=>run(true));

  function renderSummary(model){
    const {plan,currency}=model;
    if(model.workflow==='withdraw'){
      els.resultKicker.textContent='Retirement withdrawal illustration';
      els.resultTitle.textContent=plan.depleted?'The portfolio runs out in this model':'Your withdrawal plan at a glance';
      const method=plan.mode==='fire'?'The first-year amount rises with inflation.':'The same percentage is recalculated from each year’s opening balance.';
      els.resultSummary.textContent=`Starting at ${fullMoney(plan.firstAnnualWithdrawal,currency)} per year (${fullMoney(plan.firstAnnualWithdrawal/12,currency)} per month). ${method} ${plan.depleted?`The balance reaches zero during year ${plan.depletionYear}.`:`An estimated ${fullMoney(plan.value,currency)} remains after ${plan.years} years.`}`;
      els.labelPrimary.textContent='First-year withdrawal';els.subPrimary.textContent='annual amount before tax';els.statPrimary.textContent=compactMoney(plan.firstAnnualWithdrawal,currency);
      els.statInvested.closest('.stat').querySelector('span').textContent='Total withdrawn';els.statInvested.closest('.stat').querySelector('small').textContent='cash taken from the portfolio';els.statInvested.textContent=compactMoney(plan.totalWithdrawn,currency);
      els.statGain.closest('.stat').querySelector('span').textContent='Ending balance';els.statGain.closest('.stat').querySelector('small').textContent='may be zero if depleted';els.statGain.textContent=compactMoney(plan.value,currency);
      els.statAfterTax.closest('.stat').querySelector('span').textContent='Monthly starting income';els.statAfterTax.closest('.stat').querySelector('small').textContent='before tax and fees';els.statAfterTax.textContent=compactMoney(plan.firstAnnualWithdrawal/12,currency);
      els.statReal.closest('.stat').querySelector('span').textContent="Ending value today";els.statReal.closest('.stat').querySelector('small').textContent='after inflation';els.statReal.textContent=compactMoney(plan.realValue,currency);
      return;
    }
    els.statInvested.closest('.stat').querySelector('span').textContent='Total invested';els.statInvested.closest('.stat').querySelector('small').textContent='your contributions';
    els.statGain.closest('.stat').querySelector('span').textContent='Growth earned';els.statGain.closest('.stat').querySelector('small').textContent='before estimated tax';
    els.statAfterTax.closest('.stat').querySelector('span').textContent='After-tax value';els.statAfterTax.closest('.stat').querySelector('small').textContent='simplified tax estimate';
    els.statReal.closest('.stat').querySelector('span').textContent="Value in today's money";els.statReal.closest('.stat').querySelector('small').textContent='after inflation and estimated tax';
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

  function renderYearly(model){
    const rows=model.plan.rows;
    els.yearlyBody.replaceChildren();
    const withdraw=model.workflow==='withdraw';
    els.thTwo.textContent=withdraw?'Opening balance':'Monthly SIP';els.thThree.textContent=withdraw?'Withdrawn this year':'Added this year';els.thFour.textContent=withdraw?'Total withdrawn':'Total invested';
    els.yearlyCopy.textContent=withdraw?'Opening balance, withdrawals, growth and remaining value.':'Opening contribution, yearly deposits, growth and ending balance.';
    els.legendSecondary.textContent=withdraw?'Withdrawn':'Invested';els.legendPrimary.textContent=withdraw?'Balance':'Value';
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      const values=withdraw?[row.year,fullMoney(row.opening),fullMoney(row.withdrawal),fullMoney(row.totalWithdrawn),fullMoney(row.growth),fullMoney(row.value),fullMoney(row.realValue)]:[row.year,fullMoney(row.monthly),fullMoney(row.added),fullMoney(row.invested),fullMoney(row.growth),fullMoney(row.value),fullMoney(row.realValue)];
      values.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.appendChild(td)});
      els.yearlyBody.appendChild(tr);
    });
  }

  function renderScenarios(model){
    const rates=[{name:'Conservative',rate:number(els.low)},{name:'Base',rate:model.options.annualReturn,base:true},{name:'Optimistic',rate:number(els.high)}].filter(item=>Number.isFinite(item.rate)&&item.rate>-100);
    els.scenarioCards.replaceChildren();
    els.scenarioIntro.textContent=model.workflow==='withdraw'?'Ending balance under lower and higher return assumptions.':model.workflow==='goal'?'Required starting monthly SIP under each return assumption.':'After-tax ending value under each return assumption.';
    rates.forEach(item=>{
      const options=Object.assign({},model.options,{annualReturn:item.rate});
      let value,label;
      if(model.workflow==='withdraw'){value=FM.simulateWithdrawal(Object.assign({},model.options,{annualReturn:item.rate})).value;label='ending balance'}
      else if(model.workflow==='goal'){const solved=FM.solveMonthly(options,model.target);value=solved.monthly;label='starting monthly SIP'}
      else{value=FM.simulate(options).afterTax;label='after-tax ending value'}
      const card=document.createElement('article');card.className='scenario-card'+(item.base?' base':'');
      const header=document.createElement('header');const title=document.createElement('h4');title.textContent=item.name;const rate=document.createElement('span');rate.textContent=pct(item.rate);header.append(title,rate);
      const strong=document.createElement('strong');strong.textContent=compactMoney(value,model.currency);const small=document.createElement('small');small.textContent=label;card.append(header,strong,small);els.scenarioCards.appendChild(card);
    });
  }

  function renderChart(rows,model){
    const withdraw=model&&model.workflow==='withdraw';
    rows=withdraw?rows.map(row=>Object.assign({},row,{invested:row.totalWithdrawn})):rows;
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
      const show=()=>showTooltip(point,rows[Number(point.dataset.index)],withdraw);point.addEventListener('mouseenter',show);point.addEventListener('focus',show);point.addEventListener('mouseleave',hideTooltip);point.addEventListener('blur',hideTooltip);
    });
  }
  function shortNumber(value){const abs=Math.abs(value);if(abs>=1e9)return (value/1e9).toFixed(1)+'B';if(abs>=1e6)return (value/1e6).toFixed(1)+'M';if(abs>=1e3)return (value/1e3).toFixed(0)+'K';return Math.round(value).toString()}
  function escapeXml(text){return String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]))}
  function showTooltip(point,row,withdraw=false){const box=els.chart.getBoundingClientRect(),svg=els.chart.viewBox.baseVal;els.tooltip.textContent=withdraw?`Year ${row.year}: ${fullMoney(row.value)} balance · ${fullMoney(row.totalWithdrawn)} withdrawn`:`Year ${row.year}: ${fullMoney(row.value)} · invested ${fullMoney(row.invested)}`;els.tooltip.style.left=`${(Number(point.getAttribute('cx'))/svg.width)*box.width}px`;els.tooltip.style.top=`${(Number(point.getAttribute('cy'))/svg.height)*box.height}px`;els.tooltip.classList.remove('hidden')}
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

  let newsStories=[];
  let activeNewsFilter='all';
  function relativeTime(dateValue){
    const timestamp=Date.parse(dateValue||'');
    if(!Number.isFinite(timestamp))return 'Recent';
    const minutes=Math.max(0,Math.floor((Date.now()-timestamp)/60000));
    if(minutes<1)return 'Just now';
    if(minutes<60)return `${minutes}m ago`;
    const hours=Math.floor(minutes/60);
    if(hours<24)return `${hours}h ago`;
    const days=Math.floor(hours/24);
    return `${days}d ago`;
  }
  function renderNews(){
    const visible=activeNewsFilter==='all'?newsStories:newsStories.filter(story=>story.category===activeNewsFilter);
    els.newsGrid.replaceChildren();
    if(!visible.length){const empty=document.createElement('p');empty.className='news-empty';empty.textContent='No stories are available in this section right now. Try again shortly.';els.newsGrid.appendChild(empty);return}
    visible.forEach(story=>{
      const card=document.createElement('article');card.className='news-card';
      const meta=document.createElement('div');meta.className='news-meta';
      const category=document.createElement('span');category.className='news-category';category.textContent=story.category==='economy'?'Markets & economy':'World & conflicts';
      const time=document.createElement('span');time.className='news-time';time.textContent=relativeTime(story.published);meta.append(category,time);
      const title=document.createElement('h3');title.textContent=story.title;
      const description=document.createElement('p');description.textContent=story.description||'Open the full story for details.';
      const link=document.createElement('a');link.href=/^https:\/\//i.test(String(story.link))?story.link:'#';link.target='_blank';link.rel='noopener noreferrer';link.textContent=`Read on ${story.source||'BBC News'} →`;
      card.append(meta,title,description,link);els.newsGrid.appendChild(card);
    });
  }
  async function loadNews(){
    els.refreshNews.disabled=true;els.newsStatus.classList.remove('error');els.newsStatus.lastChild.textContent=' Updating latest stories…';
    try{
      const response=await fetch('/api/news',{headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('News service unavailable');
      const payload=await response.json();
      if(!Array.isArray(payload.stories)||!payload.stories.length)throw new Error('No stories returned');
      newsStories=payload.stories;renderNews();els.newsStatus.lastChild.textContent=` Updated ${relativeTime(payload.updatedAt)}`;
    }catch{
      if(!newsStories.length){els.newsGrid.replaceChildren();const empty=document.createElement('p');empty.className='news-empty';empty.textContent='Live news is temporarily unavailable. The calculator and learning guide still work normally.';els.newsGrid.appendChild(empty)}
      els.newsStatus.classList.add('error');els.newsStatus.lastChild.textContent=' News temporarily unavailable';
    }finally{els.refreshNews.disabled=false}
  }
  els.newsFilters.forEach(button=>button.addEventListener('click',()=>{activeNewsFilter=button.dataset.newsFilter;els.newsFilters.forEach(item=>item.classList.toggle('active',item===button));renderNews()}));
  if(els.refreshNews)els.refreshNews.addEventListener('click',loadNews);

  function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function csvCell(value){const text=String(value);return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text}
  function reportRows(model){
    if(model.workflow==='withdraw'){
      const mode=model.plan.mode==='fire'?'FIRE-style inflation-adjusted spending':'Percentage of opening balance each year';
      const meta=[['Compounded Withdrawal Plan'],['Workflow','Retirement / FIRE withdrawal illustration'],['Method',mode],['Currency',model.currency],['Years requested',model.plan.years],['Annual return',model.options.annualReturn+'%'],['Inflation',model.options.inflationPercent+'%'],['Starting withdrawal rate',model.options.withdrawalRate+'%'],['Starting portfolio',model.plan.startingBalance],['First annual withdrawal',model.plan.firstAnnualWithdrawal],['Total withdrawn',model.plan.totalWithdrawn],['Ending balance',model.plan.value],['Ending balance in today\'s money',model.plan.realValue],['Portfolio depleted',model.plan.depleted?'Yes, year '+model.plan.depletionYear:'No'],[]];
      const header=['Year','Opening balance','Withdrawn this year','Total withdrawn','Growth this year','Ending balance','Today\'s value'];
      const rows=model.plan.rows.map(row=>[row.year,row.opening,row.withdrawal,row.totalWithdrawn,row.growth,row.value,row.realValue]);
      return {meta,header,rows};
    }
    const meta=[['Compounding Calculator'],['Workflow',model.workflow==='goal'?'Goal / reverse calculator':'Wealth projection'],['Currency',model.currency],['Years',model.plan.years],['Annual return',model.options.annualReturn+'%'],['Annual SIP step-up',model.options.stepPercent+'%'],['Inflation',model.options.inflationPercent+'%'],['Estimated tax on gain',model.options.taxPercent+'%']];
    if(model.workflow==='goal'){meta.push(['Future target',model.target],['Required starting monthly SIP',model.requiredMonthly])}else meta.push(['Starting monthly SIP',model.plan.monthly]);
    meta.push(['Opening lump sum',model.plan.lump],['Total invested',model.plan.invested],['Future value',model.plan.value],['After-tax value',model.plan.afterTax],['Value in today\'s money',model.plan.realValue],[]);
    const header=['Year','Monthly SIP','Added this year','Total invested','Growth this year','Ending value','After-tax value','Today\'s value'];
    const rows=model.plan.rows.map(row=>[row.year,row.monthly,row.added,row.invested,row.growth,row.value,row.afterTax,row.realValue]);
    return {meta,header,rows};
  }
  els.csv.addEventListener('click',()=>{if(!state.last)return;const report=reportRows(state.last);const lines=[...report.meta,report.header,...report.rows].map(row=>row.map(csvCell).join(','));download(state.last.workflow==='withdraw'?'compounded-withdrawal-plan.csv':'compounded-yearly-plan.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8')});

  function pdfEscape(value){return String(value).replace(/[^\x20-\x7E]/g,'?').replace(/([\\()])/g,'\\$1')}
  function makePdf(lines){
    const pages=[];for(let i=0;i<lines.length;i+=46)pages.push(lines.slice(i,i+46));
    const objects=[];const pageIds=pages.map((_,i)=>4+i*2),contentIds=pages.map((_,i)=>5+i*2);
    objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pages.length} >>`;objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    pages.forEach((page,index)=>{const commands=['BT','/F1 9 Tf','42 760 Td'];page.forEach((line,lineIndex)=>{if(lineIndex)commands.push('0 -15 Td');commands.push(`(${pdfEscape(line)}) Tj`)});commands.push('ET');const stream=commands.join('\n');objects[pageIds[index]]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;objects[contentIds[index]]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`});
    let pdf='%PDF-1.4\n%----\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return pdf;
  }
  els.pdf.addEventListener('click',()=>{
    if(!state.last)return;const model=state.last,report=reportRows(model);const lines=['COMPOUNDED - '+(model.workflow==='withdraw'?'WITHDRAWAL PLAN':'INVESTMENT PLAN'),''];report.meta.forEach(row=>{if(row.length)lines.push(`${row[0]}: ${typeof row[1]==='number'&&row[0]!=='Years'&&row[0]!=='Years requested'?rawMoney(row[1],model.currency):row[1]}`);else lines.push('')});lines.push(report.header.join(' | '));report.rows.forEach(row=>lines.push(row.map((value,index)=>index===0?String(value):rawMoney(value,model.currency)).join(' | ')));lines.push('','Illustration only. Constant returns do not model real market volatility, fees, tax, RRIF minimums or sequence risk.');download(model.workflow==='withdraw'?'compounded-withdrawal-plan.pdf':'compounded-yearly-plan.pdf',makePdf(lines),'application/pdf');
  });

  updateForm();
  document.querySelectorAll('.currency-symbol').forEach(node=>node.textContent=symbols[els.currency.value]);
  if(!window.CompoundedCommon){loadMarkets();setInterval(loadMarkets,60000)}
  if(els.newsGrid){loadNews();setInterval(loadNews,600000)}
})();
