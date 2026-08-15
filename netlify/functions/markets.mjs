const MARKETS = [
  { symbol:'GC=F', label:'Gold Futures USD/oz', decimals:2 },
  { symbol:'CL=F', label:'WTI Oil USD/bbl', decimals:2 },
  { symbol:'^GSPC', label:'S&P 500', decimals:2 },
  { symbol:'^IXIC', label:'Nasdaq Composite', decimals:2 },
  { symbol:'^GSPTSE', label:'S&P/TSX', decimals:2 },
  { symbol:'^FTSE', label:'FTSE 100', decimals:2 },
  { symbol:'^KS11', label:'KOSPI', decimals:2 },
  { symbol:'000001.SS', label:'Shanghai Composite', decimals:2 },
  { symbol:'^NSEI', label:'Nifty 50', decimals:2 },
  { symbol:'^BSESN', label:'Sensex', decimals:2 },
  { symbol:'^N225', label:'Nikkei 225', decimals:2 }
];

async function quote(market){
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(market.symbol)}?range=1d&interval=5m&includePrePost=false`;

  try{
    const response = await fetch(url, {
      headers:{ Accept:'application/json', 'User-Agent':'Mozilla/5.0 market-ticker/1.0' },
      signal:controller.signal
    });
    if(!response.ok) throw new Error(`Yahoo response ${response.status}`);

    const payload = await response.json();
    const meta = payload?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    if(!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0){
      throw new Error('Incomplete Yahoo quote');
    }

    return {
      symbol:market.symbol,
      label:market.label,
      decimals:market.decimals,
      price,
      change:price - previousClose,
      changePercent:((price - previousClose) / previousClose) * 100,
      currency:meta.currency ?? null,
      marketTime:meta.regularMarketTime ?? null
    };
  }finally{
    clearTimeout(timeout);
  }
}

export default async () => {
  const settled = await Promise.allSettled(MARKETS.map(quote));
  const markets = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);

  return new Response(JSON.stringify({
    markets,
    updatedAt:new Date().toISOString(),
    source:'Yahoo Finance',
    delayed:true
  }), {
    status:markets.length ? 200 : 502,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      'X-Content-Type-Options':'nosniff'
    }
  });
};

export const config = { path:'/api/markets' };
