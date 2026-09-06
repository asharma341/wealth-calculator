(function(){
  'use strict';
  window.CompoundedCommon=true;
  const themeButton=document.getElementById('theme-toggle');
  const themeLabel=document.getElementById('theme-label');
  function setTheme(dark){
    document.documentElement.dataset.theme=dark?'dark':'light';
    if(themeButton)themeButton.setAttribute('aria-checked',String(dark));
    if(themeLabel)themeLabel.textContent=dark?'Dark':'Light';
    try{localStorage.setItem('compounded-theme',dark?'dark':'light')}catch{}
  }
  let saved='';try{saved=localStorage.getItem('compounded-theme')||''}catch{}
  setTheme(saved?saved==='dark':Boolean(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches));
  if(themeButton)themeButton.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme!=='dark'));

  const marketTrack=document.getElementById('market-track');
  let hasMarketData=false;
  function tickerSet(items){
    const set=document.createElement('div');set.className='ticker-set';
    items.forEach((item,index)=>{
      const node=document.createElement('span');node.className='ticker-item';
      const name=document.createElement('span');name.className='ticker-name';name.textContent=item.label;
      const price=document.createElement('span');price.className='ticker-price';price.textContent=Number(item.price).toLocaleString('en-US',{minimumFractionDigits:item.decimals,maximumFractionDigits:item.decimals});
      const change=document.createElement('span');const direction=item.changePercent>0?'up':item.changePercent<0?'down':'flat';change.className=`ticker-change ${direction}`;change.textContent=`${item.changePercent>0?'▲':item.changePercent<0?'▼':'•'} ${Math.abs(item.changePercent).toFixed(2)}%`;
      node.append(name,price,change);set.appendChild(node);
      if(index<items.length-1){const dot=document.createElement('span');dot.className='ticker-dot';dot.textContent='•';set.appendChild(dot)}
    });
    return set;
  }
  async function loadMarkets(){
    if(!marketTrack)return;
    try{
      const response=await fetch('/api/markets',{headers:{Accept:'application/json'}});if(!response.ok)throw new Error();
      const payload=await response.json();if(!Array.isArray(payload.markets)||!payload.markets.length)throw new Error();
      const first=tickerSet(payload.markets),second=first.cloneNode(true);second.setAttribute('aria-hidden','true');marketTrack.replaceChildren(first,second);marketTrack.dataset.ready='true';hasMarketData=true;
    }catch{
      if(!hasMarketData){const message=document.createElement('span');message.className='ticker-message';message.textContent='Market prices are temporarily unavailable — retrying automatically.';marketTrack.replaceChildren(message);marketTrack.dataset.ready='false'}
    }
  }

  function relativeTime(value){
    const time=Date.parse(value||'');if(!Number.isFinite(time))return 'Recent';
    const minutes=Math.max(0,Math.floor((Date.now()-time)/60000));if(minutes<1)return 'Now';if(minutes<60)return `${minutes}m`;const hours=Math.floor(minutes/60);if(hours<24)return `${hours}h`;return `${Math.floor(hours/24)}d`;
  }
  function safeExternalUrl(value){try{const url=new URL(String(value));return url.protocol==='https:'?url.href:null}catch{return null}}
  function railStory(story){
    const link=document.createElement('a');link.className='rail-story';link.href=safeExternalUrl(story.link)||'/news.html';link.target='_blank';link.rel='noopener noreferrer';
    const meta=document.createElement('span');meta.textContent=`${story.provider||story.source||'News'} · ${relativeTime(story.published)}`;
    const title=document.createElement('strong');title.textContent=story.title;link.append(meta,title);return link;
  }
  function fillRail(node,stories,title){
    if(!node)return;node.replaceChildren();const heading=document.createElement('h2');heading.textContent=title;node.appendChild(heading);stories.forEach(story=>node.appendChild(railStory(story)));
    const more=document.createElement('a');more.className='rail-more';more.href='/news.html';more.textContent='See all news →';node.appendChild(more);
  }
  async function loadNewsRails(){
    const left=document.querySelector('[data-news-rail="left"]'),right=document.querySelector('[data-news-rail="right"]'),mobile=document.querySelector('[data-news-rail="mobile"]');
    if(!left&&!right&&!mobile)return;
    try{
      const response=await fetch('/api/news',{headers:{Accept:'application/json'}});if(!response.ok)throw new Error();const payload=await response.json();const stories=Array.isArray(payload.stories)?payload.stories:[];if(!stories.length)throw new Error();
      const economy=stories.filter(story=>story.category==='economy'||story.category==='policy');
      const world=stories.filter(story=>story.category==='world');
      fillRail(left,economy.slice(0,4),'Markets now');fillRail(right,world.slice(0,4),'World watch');
      if(mobile){mobile.replaceChildren();const label=document.createElement('strong');label.textContent='Latest';mobile.appendChild(label);stories.slice(0,6).forEach(story=>mobile.appendChild(railStory(story)))}
    }catch{
      [left,right].forEach(node=>{if(node){node.replaceChildren();const note=document.createElement('p');note.className='rail-unavailable';note.textContent='Headlines are temporarily unavailable.';node.appendChild(note)}});
      if(mobile)mobile.classList.add('hidden');
    }
  }
  loadMarkets();setInterval(loadMarkets,60000);
  loadNewsRails();setInterval(loadNewsRails,600000);
})();
