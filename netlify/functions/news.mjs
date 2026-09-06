const FEEDS=[
  {url:'https://finance.yahoo.com/rss/topstories',category:'economy',source:'Yahoo Finance'},
  {url:'https://feeds.bbci.co.uk/news/business/rss.xml',category:'economy',source:'BBC Business'},
  {url:'https://feeds.bbci.co.uk/news/world/rss.xml',category:'world',source:'BBC World'},
  {url:'https://www.federalreserve.gov/feeds/press_all.xml',category:'policy',source:'Federal Reserve'},
  {url:'https://www.ecb.europa.eu/rss/press.html',category:'policy',source:'European Central Bank'}
];

const WORLD_RELEVANCE=/\b(war|conflict|attack|military|missile|ceasefire|sanction|trade|tariff|oil|gas|econom|market|bank|inflation|debt|currency|shipping|nuclear|government|election|crisis|border|peace|security)\b/i;
const ALLOWED_LINK_HOSTS=['finance.yahoo.com','bbc.co.uk','bbc.com','federalreserve.gov','ecb.europa.eu'];

function safeNewsLink(value=''){
  try{
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    return url.protocol==='https:'&&ALLOWED_LINK_HOSTS.some(allowed=>host===allowed||host.endsWith(`.${allowed}`))?url.href:'';
  }catch{return ''}
}

function decodeEntities(text=''){
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(match,entity)=>{
    if(entity[0]==='#'){
      const hex=entity[1].toLowerCase()==='x';
      const value=parseInt(entity.slice(hex?2:1),hex?16:10);
      return Number.isFinite(value)?String.fromCodePoint(value):match;
    }
    return named[entity.toLowerCase()]??match;
  });
}

function clean(text=''){
  return decodeEntities(text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
}

function tag(block,name){
  const match=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
  return match?clean(match[1]):'';
}

function parseFeed(xml,category,defaultSource='Verified news source'){
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match=>{
    const block=match[1];
    const title=tag(block,'title').slice(0,240);
    const link=safeNewsLink(tag(block,'link'));
    const description=tag(block,'description').slice(0,600);
    const published=tag(block,'pubDate');
    return {title,link,description,published,category,provider:defaultSource,source:tag(block,'source')||defaultSource};
  }).filter(item=>item.title&&/^https?:\/\//i.test(item.link));
}

async function fetchFeed(feed){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(feed.url,{headers:{Accept:'application/rss+xml, application/xml, text/xml','User-Agent':'Compounded news reader/1.0'},signal:controller.signal});
    if(!response.ok)throw new Error(`Feed response ${response.status}`);
    return parseFeed(await response.text(),feed.category,feed.source);
  }finally{clearTimeout(timer)}
}

export default async()=>{
  const settled=await Promise.allSettled(FEEDS.map(fetchFeed));
  const all=settled.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  const yahoo=all.filter(item=>item.category==='economy'&&item.source!=='BBC Business').slice(0,5);
  const business=all.filter(item=>item.category==='economy'&&item.source==='BBC Business').slice(0,4);
  const policy=[...all.filter(item=>item.provider==='Federal Reserve').slice(0,2),...all.filter(item=>item.provider==='European Central Bank').slice(0,2)];
  const world=all.filter(item=>item.category==='world'&&WORLD_RELEVANCE.test(`${item.title} ${item.description}`)).slice(0,5);
  const fallbackWorld=world.length>=3?[]:all.filter(item=>item.category==='world').slice(0,3-world.length);
  const seen=new Set();
  const stories=[...yahoo,...business,...policy,...world,...fallbackWorld].filter(item=>{if(seen.has(item.link))return false;seen.add(item.link);return true}).sort((a,b)=>Date.parse(b.published||0)-Date.parse(a.published||0)).slice(0,18);
  return new Response(JSON.stringify({stories,updatedAt:new Date().toISOString(),sources:['Yahoo Finance','BBC News','Federal Reserve','European Central Bank']}),{
    status:stories.length?200:502,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=120, s-maxage=600, stale-while-revalidate=1800','X-Content-Type-Options':'nosniff'}
  });
};

export {parseFeed,clean,safeNewsLink};
export const config={path:'/api/news'};
