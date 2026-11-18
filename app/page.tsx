 "use client";
import { useEffect, useMemo, useState } from "react";

type Product = { id:string; name:string; game:string; set_name:string|null; condition:string; price_pence:number; image_url:string|null; stock:number; };
const demo: Product[] = [
 {id:"demo-1",name:"Charizard ex",game:"Pokémon",set_name:"Obsidian Flames",condition:"Near Mint",price_pence:2499,image_url:null,stock:1},
 {id:"demo-2",name:"Pikachu",game:"Pokémon",set_name:"Paldea Evolved",condition:"Near Mint",price_pence:350,image_url:null,stock:4},
 {id:"demo-3",name:"Blue-Eyes White Dragon",game:"Yu-Gi-Oh!",set_name:"Legend of Blue Eyes",condition:"Excellent",price_pence:899,image_url:null,stock:1},
 {id:"demo-4",name:"Monkey D. Luffy",game:"One Piece",set_name:"Awakening of the New Era",condition:"Near Mint",price_pence:649,image_url:null,stock:2},
 {id:"demo-5",name:"Gengar",game:"Pokémon",set_name:"Lost Origin",condition:"Excellent",price_pence:899,image_url:null,stock:1},
 {id:"demo-6",name:"Mewtwo VSTAR",game:"Pokémon",set_name:"Pokémon GO",condition:"Near Mint",price_pence:649,image_url:null,stock:3},
 {id:"demo-7",name:"Eevee",game:"Pokémon",set_name:"151",condition:"Near Mint",price_pence:225,image_url:null,stock:5},
 {id:"demo-8",name:"Roronoa Zoro",game:"One Piece",set_name:"Paramount War",condition:"Near Mint",price_pence:525,image_url:null,stock:2}
];
const gbp=(p:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(p/100);
export default function Home(){
 const [products,setProducts]=useState<Product[]>(demo),[q,setQ]=useState(""),[game,setGame]=useState("All games"),[cart,setCart]=useState<Record<string,number>>({}),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 useEffect(()=>{fetch("/api/products").then(r=>r.ok?r.json():null).then(d=>{if(d?.products)setProducts(d.products)}).catch(()=>{});},[]);
 const visible=useMemo(()=>products.filter(p=>(p.name+" "+(p.set_name||"")).toLowerCase().includes(q.toLowerCase())&&(game==="All games"||p.game===game)&&p.stock>0),[products,q,game]);
 const count=Object.values(cart).reduce((a,b)=>a+b,0);
 const total=products.reduce((s,p)=>s+(cart[p.id]||0)*p.price_pence,0);
 function add(p:Product){setCart(c=>({...c,[p.id]:Math.min((c[p.id]||0)+1,p.stock)}));setNotice(p.name+" added to basket");}
 async function checkout(){setBusy(true);setNotice("");try{const items=Object.entries(cart).filter(([,qty])=>qty>0).map(([product_id,quantity])=>({product_id,quantity}));const r=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Checkout could not be started.");if(d.url)window.location.href=d.url;else throw new Error("Payment service is not configured yet.");}catch(e){setNotice(e instanceof Error?e.message:"Checkout error");}finally{setBusy(false)}}
 return <><header className="topbar"><div className="shell nav"><a className="logo" href="#"><span className="logoMark">G</span>GRANDMASTER<b>TCG</b></a><div className="navlinks"><a href="#singles">Shop singles</a><a href="#about">About</a><button className="cart" onClick={()=>document.getElementById("basket")?.scrollIntoView({behavior:"smooth"})}>Basket ({count})</button></div></div></header>
 <main><section className="hero"><div className="shell"><div className="eyebrow">Your collection starts here</div><h1>Find the cards<br/>you’re chasing.</h1><p>Shop individual trading cards across Pokémon, Yu-Gi-Oh!, One Piece and more. Discover your next favourite addition at GrandmasterTCG.</p><a className="cta" href="#singles">Explore singles</a><div className="trust"><span>✓ Single-card listings</span><span>✓ Condition shown clearly</span><span>✓ UK delivery</span></div></div></section>
 <section className="section" id="singles"><div className="shell"><div className="sectionHead"><div><h2>Shop trading card singles</h2><p className="muted">Find cards by name, game or set.</p></div></div><div className="filters"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search cards or sets…"/><select value={game} onChange={e=>setGame(e.target.value)}><option>All games</option><option>Pokémon</option><option>Yu-Gi-Oh!</option><option>One Piece</option><option>Magic: The Gathering</option><option>Lorcana</option></select></div><div className="grid">{visible.length?visible.map(p=><article className="product" key={p.id}><div className="art">{p.image_url?<img src={p.image_url} alt={p.name}/>:<div className="cardPlaceholder">SINGLE CARD<br/><small>{p.name}</small></div>}</div><div className="productInfo"><span className="pill">{p.game}</span><div className="productName">{p.name}</div><div className="details">{p.set_name||"Set not specified"} · {p.condition}</div><div className="productBottom"><span className="price">{gbp(p.price_pence)}</span><button className="add" onClick={()=>add(p)}>Add</button></div></div></article>):<div className="empty">No matching cards are currently in stock.</div>}</div></div></section>
 <section className="about" id="about"><div className="shell"><h2>Collect what you love.</h2><p>GrandmasterTCG is an independent trading card store for collectors. Listings should include accurate card details, condition and photographs so you can shop with confidence.</p></div></section>
 <section className="section" id="basket"><div className="shell"><h2>Your basket</h2>{count===0?<p className="muted">Your basket is empty. Add a card to get started.</p>:<><p>{count} item(s) · <strong>{gbp(total)}</strong></p><button className="cart" disabled={busy} onClick={checkout}>{busy?"Starting checkout…":"Secure checkout"}</button></>}{notice&&<p className="muted" role="status">{notice}</p>}</div></section></main>
 <footer><div className="shell">© {new Date().getFullYear()} GrandmasterTCG. Independent trading card retailer. All trademarks belong to their respective owners.</div></footer></>;
}
