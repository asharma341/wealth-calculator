(function(){
  'use strict';
  const grid=document.getElementById('news-grid'),status=document.getElementById('news-status'),refresh=document.getElementById('refresh-news'),filters=[...document.querySelectorAll('[data-news-filter]')];
  if(!grid)return;
  let stories=[],active='all';
  function relativeTime(value){const time=Date.parse(value||'');if(!Number.isFinite(time))return 'Recent';const minutes=Math.max(0,Math.floor((Date.now()-time)/60000));if(minutes<1)return 'Just now';if(minutes<60)return `${minutes}m ago`;const hours=Math.floor(minutes/60);if(hours<24)return `${hours}h ago`;return `${Math.floor(hours/24)}d ago`}
  function safeExternalUrl(value){try{const url=new URL(String(value));return url.protocol==='https:'?url.href:null}catch{return null}}
  function categoryLabel(category){return category==='world'?'World & conflicts':category==='policy'?'Central banks':'Markets & economy'}
  function render(){
    const visible=active==='all'?stories:stories.filter(story=>story.category===active);grid.replaceChildren();
    if(!visible.length){const empty=document.createElement('p');empty.className='news-empty';empty.textContent='No stories are available in this category right now.';grid.appendChild(empty);return}
    visible.forEach(story=>{
      const card=document.createElement('article');card.className='news-card';const meta=document.createElement('div');meta.className='news-meta';const category=document.createElement('span');category.className='news-category';category.textContent=categoryLabel(story.category);const time=document.createElement('span');time.className='news-time';time.textContent=relativeTime(story.published);meta.append(category,time);
      const title=document.createElement('h3');title.textContent=story.title;const description=document.createElement('p');description.textContent=story.description||'Open the source for the full report.';const link=document.createElement('a');link.href=safeExternalUrl(story.link)||'#';link.target='_blank';link.rel='noopener noreferrer';const provider=story.provider||story.source||'Source';link.textContent=`${provider}${story.source&&story.source!==provider?' · '+story.source:''} →`;card.append(meta,title,description,link);grid.appendChild(card);
    });
  }
  async function load(){
    refresh.disabled=true;status.classList.remove('error');status.lastChild.textContent=' Updating…';
    try{const response=await fetch('/api/news',{headers:{Accept:'application/json'}});if(!response.ok)throw new Error();const data=await response.json();if(!Array.isArray(data.stories)||!data.stories.length)throw new Error();stories=data.stories;render();status.lastChild.textContent=` Updated ${relativeTime(data.updatedAt)}`}
    catch{if(!stories.length){grid.replaceChildren();const empty=document.createElement('p');empty.className='news-empty';empty.textContent='Live news is temporarily unavailable. Please try again shortly.';grid.appendChild(empty)}status.classList.add('error');status.lastChild.textContent=' Temporarily unavailable'}finally{refresh.disabled=false}
  }
  filters.forEach(button=>button.addEventListener('click',()=>{active=button.dataset.newsFilter;filters.forEach(item=>item.classList.toggle('active',item===button));render()}));refresh.addEventListener('click',load);load();setInterval(load,600000);
})();
