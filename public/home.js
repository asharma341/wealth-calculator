(function(){
  'use strict';
  const amount=document.getElementById('starter-amount'),years=document.getElementById('starter-years'),inflation=document.getElementById('starter-inflation'),savingsRate=document.getElementById('starter-savings-rate'),currency=document.getElementById('starter-currency'),symbol=document.getElementById('starter-symbol'),button=document.getElementById('starter-calculate'),results=document.getElementById('starter-results'),summary=document.getElementById('starter-summary');
  if(!button)return;
  const labels=[['Savings account',()=>Number(savingsRate.value),false],['Fixed-deposit reference',()=>6.5,true],['Government-bond reference',()=>6.9,true],['Gold history reference',()=>8,true],['Broad-stock history reference',()=>10,true]];
  function money(value){try{return new Intl.NumberFormat(currency.value==='INR'?'en-IN':'en-US',{style:'currency',currency:currency.value,maximumFractionDigits:0}).format(value)}catch{return `${currency.value} ${Math.round(value).toLocaleString()}`}}
  function calculate(){
    const principal=Number(amount.value),period=Math.floor(Number(years.value)),inflationRate=Number(inflation.value);
    if(!Number.isFinite(principal)||principal<=0||!Number.isFinite(period)||period<1||period>40||!Number.isFinite(inflationRate)||inflationRate<0){summary.textContent='Enter a savings amount, 1–40 years and a valid inflation rate.';results.replaceChildren();return}
    results.replaceChildren();
    labels.forEach(([name,rateFn,reference])=>{
      const rate=rateFn(),nominal=principal*Math.pow(1+rate/100,period),real=nominal/Math.pow(1+inflationRate/100,period);
      const card=document.createElement('article');card.className='starter-result'+(name.includes('stock')?' highlight':'');
      const heading=document.createElement('span');heading.textContent=name;
      const value=document.createElement('strong');value.textContent=money(nominal);
      const note=document.createElement('small');note.textContent=`${rate.toFixed(1)}% yearly · about ${money(real)} in today's purchasing power${reference?' · reference, not forecast':''}`;
      card.append(heading,value,note);results.appendChild(card);
    });
    const idleReal=principal/Math.pow(1+inflationRate/100,period),loss=principal-idleReal;
    summary.textContent=`At ${inflationRate.toFixed(1)}% inflation, ${money(principal)} earning no return would lose about ${money(loss)} of today's purchasing power over ${period} years. These comparisons ignore tax and risk.`;
  }
  button.addEventListener('click',calculate);currency.addEventListener('change',()=>{symbol.textContent={USD:'$',CAD:'CA$',INR:'₹',EUR:'€',GBP:'£'}[currency.value]||currency.value;calculate()});calculate();
})();
