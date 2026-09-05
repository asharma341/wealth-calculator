const FEEDS=[
  {url:'https://feeds.bbci.co.uk/news/business/rss.xml',category:'economy'},
  {url:'https://feeds.bbci.co.uk/news/world/rss.xml',category:'world'}
];

const WORLD_RELEVANCE=/\b(war|conflict|attack|military|missile|ceasefire|sanction|trade|tariff|oil|gas|econom|market|bank|inflation|debt|currency|shipping|nuclear|government|election|crisis|border|peace|security)\b/i;

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

function parseFeed(xml,category){
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match=>{
    const block=match[1];
    const title=tag(block,'title');
    const link=tag(block,'link');
    const description=tag(block,'description');
    const published=tag(block,'pubDate');
    return {title,link,description,published,category,source:'BBC News'};
  }).filter(item=>item.title&&/^https?:\/\//i.test(item.link));
}

async function fetchFeed(feed){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(feed.url,{headers:{Accept:'application/rss+xml, application/xml, text/xml','User-Agent':'Compounded news reader/1.0'},signal:controller.signal});
    if(!response.ok)throw new Error(`Feed response ${response.status}`);
    return parseFeed(await response.text(),feed.category);
  }finally{clearTimeout(timer)}
}

export default async()=>{
  const settled=await Promise.allSettled(FEEDS.map(fetchFeed));
  const all=settled.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  const business=all.filter(item=>item.category==='economy').slice(0,6);
  const world=all.filter(item=>item.category==='world'&&WORLD_RELEVANCE.test(`${item.title} ${item.description}`)).slice(0,6);
  const fallbackWorld=world.length>=3?[]:all.filter(item=>item.category==='world').slice(0,3-world.length);
  const seen=new Set();
  const stories=[...business,...world,...fallbackWorld].filter(item=>{if(seen.has(item.link))return false;seen.add(item.link);return true}).sort((a,b)=>Date.parse(b.published||0)-Date.parse(a.published||0)).slice(0,9);
  return new Response(JSON.stringify({stories,updatedAt:new Date().toISOString(),source:'BBC News RSS'}),{
    status:stories.length?200:502,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=120, s-maxage=600, stale-while-revalidate=1800','X-Content-Type-Options':'nosniff'}
  });
};

export {parseFeed,clean};
export const config={path:'/api/news'};
