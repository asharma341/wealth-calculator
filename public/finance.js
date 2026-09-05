(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FinanceMath=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function finite(value,fallback=0){
    const number=Number(value);
    return Number.isFinite(number)?number:fallback;
  }

  function monthlyRate(annualPercent){
    const annual=finite(annualPercent)/100;
    if(annual<=-1)throw new Error('Annual return must be greater than -100%.');
    return Math.pow(1+annual,1/12)-1;
  }

  function afterTaxValue(value,invested,taxPercent){
    const gain=Math.max(0,value-invested);
    return value-gain*Math.max(0,finite(taxPercent))/100;
  }

  function simulate(options){
    const years=Math.max(1,Math.floor(finite(options.years,1)));
    const monthly=Math.max(0,finite(options.monthly));
    const lump=Math.max(0,finite(options.lump));
    const step=Math.max(0,finite(options.stepPercent))/100;
    const inflation=Math.max(0,finite(options.inflationPercent))/100;
    const tax=Math.min(100,Math.max(0,finite(options.taxPercent)));
    const rate=finite(options.annualReturn);
    const mr=monthlyRate(rate);
    let balance=lump;
    let invested=lump;
    let yearStartBalance=lump;
    let contributionsThisYear=lump;
    const rows=[];

    for(let month=1;month<=years*12;month++){
      const yearIndex=Math.floor((month-1)/12);
      const currentMonthly=monthly*Math.pow(1+step,yearIndex);
      balance+=currentMonthly;
      invested+=currentMonthly;
      contributionsThisYear+=currentMonthly;
      balance*=1+mr;

      if(month%12===0){
        const year=month/12;
        const gainThisYear=balance-yearStartBalance-contributionsThisYear;
        const available=afterTaxValue(balance,invested,tax);
        rows.push({
          year,
          monthly:currentMonthly,
          added:contributionsThisYear,
          invested,
          growth:gainThisYear,
          value:balance,
          afterTax:available,
          realValue:available/Math.pow(1+inflation,year)
        });
        yearStartBalance=balance;
        contributionsThisYear=0;
      }
    }

    const gain=balance-invested;
    const afterTax=afterTaxValue(balance,invested,tax);
    return {years,monthly,lump,rate,stepPercent:step*100,invested,value:balance,gain,afterTax,realValue:afterTax/Math.pow(1+inflation,years),rows};
  }

  function solveMonthly(options,target){
    const wanted=Math.max(0,finite(target));
    const base=Object.assign({},options,{monthly:0});
    const withoutSip=simulate(base);
    if(withoutSip.afterTax>=wanted)return {monthly:0,plan:withoutSip};
    let low=0;
    let high=Math.max(1,wanted/(Math.max(1,finite(options.years))*12));
    let candidate=simulate(Object.assign({},options,{monthly:high}));
    let guard=0;
    while(candidate.afterTax<wanted&&guard<80){
      high*=2;
      candidate=simulate(Object.assign({},options,{monthly:high}));
      guard++;
    }
    if(candidate.afterTax<wanted)throw new Error('The target is too large for this calculator.');
    for(let i=0;i<90;i++){
      const mid=(low+high)/2;
      candidate=simulate(Object.assign({},options,{monthly:mid}));
      if(candidate.afterTax>=wanted)high=mid;else low=mid;
    }
    const monthly=high;
    return {monthly,plan:simulate(Object.assign({},options,{monthly}))};
  }

  function cagr(beginning,ending,years){
    const start=finite(beginning),finish=finite(ending),period=finite(years);
    if(start<=0||finish<0||period<=0)return null;
    return Math.pow(finish/start,1/period)-1;
  }

  function realReturn(nominalPercent,inflationPercent){
    return ((1+finite(nominalPercent)/100)/(1+finite(inflationPercent)/100)-1)*100;
  }

  return {simulate,solveMonthly,cagr,realReturn,afterTaxValue,monthlyRate};
});
