const JSON_HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const enc=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const dec=s=>atob(s.replace(/-/g,"+").replace(/_/g,"/"));
const uid=()=>crypto.randomUUID();
const str=(v,n=5000)=>String(v??"").trim().slice(0,n);
const digits=v=>String(v??"").replace(/\D/g,"");
const validMobile=v=>/^[6-9]\d{9}$/.test(v);
const reply=(data,status=200,origin="*")=>new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS","Vary":"Origin"}});
const fail=(message,status=400,origin="*")=>reply({success:false,error:message},status,origin);
const readBody=async req=>{try{return await req.json()}catch{return null}};
const all=async(db,sql,...a)=>(await db.prepare(sql).bind(...a).all()).results||[];
const first=async(db,sql,...a)=>db.prepare(sql).bind(...a).first();
const run=async(db,sql,...a)=>db.prepare(sql).bind(...a).run();
async function sign(s,secret){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return enc(await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(s)))}
async function token(payload,secret){const p=enc(new TextEncoder().encode(JSON.stringify(payload)));return p+"."+await sign(p,secret)}
async function claims(req,secret){try{const t=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");const [p,s]=t.split(".");if(!p||!s||!secret||await sign(p,secret)!==s)return null;const c=JSON.parse(new TextDecoder().decode(Uint8Array.from(dec(p),x=>x.charCodeAt(0))));return c.exp>Date.now()?c:null}catch{return null}}
async function isAdmin(req,env){return (await claims(req,env.ADMIN_SESSION_SECRET))?.role==="admin"}
async function table(db,t){return !!(await first(db,"SELECT name FROM sqlite_master WHERE type='table' AND name=?",t))}
async function cols(db,t){return (await all(db,`PRAGMA table_info(${t})`)).map(x=>x.name)}
function safeAd(b,mobile,status="approved"){return {id:uid(),title:str(b.title,160),description:str(b.description,5000),category:str(b.category,100),district:str(b.district,100),area:str(b.area,120),price:str(b.price,40),phone:mobile||digits(b.phone),whatsapp:digits(b.whatsapp||mobile||b.phone),image_url:str(b.image_url||b.image,2048),status}}
async function saveAd(db,a){await run(db,"INSERT INTO ads(id,title,description,category,district,area,price,phone,whatsapp,image_url,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,datetime('now'))",a.id,a.title,a.description,a.category,a.district,a.area,a.price,a.phone,a.whatsapp,a.image_url,a.status)}
async function listAreas(db,district){
 if(!await table(db,"areas"))return [];
 const value=str(district,100);
 if(!value)return [];
 const c=await cols(db,"areas");
 // Current HEY MR schema stores the district relation as areas.district_id.
 // Accept either the numeric district ID (used by the homepage dropdown)
 // or a district name, so this works for all 38 districts.
 if(c.includes("district_id")&&await table(db,"districts")){
  if(/^\d+$/.test(value)){
   return all(db,"SELECT * FROM areas WHERE district_id=? ORDER BY name",Number(value));
  }
  const dcols=await cols(db,"districts");
  const name=dcols.includes("name")?"name":dcols.includes("district_name")?"district_name":null;
  if(name){
   return all(db,`SELECT a.* FROM areas a JOIN districts d ON a.district_id=d.id WHERE LOWER(d.${name})=LOWER(?) ORDER BY a.name`,value);
  }
  return [];
 }
 const dc=c.includes("district_name")?"district_name":c.includes("district")?"district":null;
 if(!dc)return [];
 if(/^\d+$/.test(value))return all(db,`SELECT * FROM areas WHERE ${dc}=? ORDER BY name`,Number(value));
 return all(db,`SELECT * FROM areas WHERE LOWER(${dc})=LOWER(?) ORDER BY name`,value);
}
export default {async fetch(req,env){
 const url=new URL(req.url),p=url.pathname.replace(/\/+$/,"")||"/";
 const configured=env.ALLOWED_ORIGIN||"*",origin=req.headers.get("Origin")||"*";
 const allow=configured==="*"||origin===configured?configured:"null";
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS","Vary":"Origin"}});
 if(!p.startsWith("/api/")){ 
   if(env.ASSETS)return env.ASSETS.fetch(req);
  return new Response("HEY MR API is running. Static assets binding is not configured.",{status:200});
 }
 const out=(d,s=200)=>reply(d,s,allow),bad=(m,s=400)=>fail(m,s,allow);
 if(!env.DB)return bad("D1 binding DB is missing in wrangler.toml",500);
 try{
  if(p==="/api/health"&&req.method==="GET"){const x=await first(env.DB,"SELECT 1 AS ok");return out({success:true,database:x?.ok===1?"connected":"error",app:"HEY MR"})}
  if(p==="/api/admin/login"&&req.method==="POST"){
   const b=await readBody(req);if(!b)return bad("Invalid JSON");
   if(!env.ADMIN_PASSWORD||!env.ADMIN_SESSION_SECRET)return bad("Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET Worker secrets",503);
   if(String(b.password||"")!==env.ADMIN_PASSWORD)return bad("Invalid admin password",401);
   return out({success:true,token:await token({role:"admin",exp:Date.now()+8*3600000},env.ADMIN_SESSION_SECRET)});
  }
  if(p==="/api/public/settings"&&req.method==="GET"){const rows=await all(env.DB,"SELECT key,value FROM settings"),settings={};for(const r of rows){try{settings[r.key]=JSON.parse(r.value)}catch{settings[r.key]=r.value}}return out({success:true,settings})}
  if(p==="/api/public/contact-settings"&&req.method==="GET"){
   const row=await first(env.DB,"SELECT value FROM settings WHERE key='contact_buttons'");
   let settings={call:true,whatsapp:true};
   if(row?.value){try{settings={...settings,...JSON.parse(row.value)}}catch{}}
   return out({success:true,settings});
  }
  if(p==="/api/public/categories"&&req.method==="GET")return out({success:true,categories:await all(env.DB,"SELECT * FROM categories WHERE active=1 ORDER BY sort_order,id")});
  if(p==="/api/public/form-fields"&&req.method==="GET")return out({success:true,fields:await all(env.DB,"SELECT id,label,field_type,required,options_json,sort_order FROM form_fields WHERE active=1 ORDER BY sort_order,id")});
  if(["/api/public/ads","/api/public/search","/api/public/filter"].includes(p)&&req.method==="GET"){
   const page=Math.max(1,Number(url.searchParams.get("page"))||1),limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||50)),w=["ads.status='approved'"],a=[];
   for(const k of ["category","district","area"]){const v=str(url.searchParams.get(k),120);if(v){w.push("ads."+k+"=?");a.push(v)}}
   const q=str(url.searchParams.get("q")||url.searchParams.get("keyword"),120);if(q){w.push("(ads.title LIKE ? OR ads.description LIKE ?)");a.push("%"+q+"%","%"+q+"%")}
   const min=url.searchParams.get("min_price"),max=url.searchParams.get("max_price");
   if(min!==null&&min!==""){w.push("CAST(ads.price AS REAL)>=?");a.push(Number(min)||0)}
   if(max!==null&&max!==""){w.push("CAST(ads.price AS REAL)<=?");a.push(Number(max)||0)}
   const sort=url.searchParams.get("sort")==="price_low"?"CAST(ads.price AS REAL) ASC":"ads.created_at DESC";
   const count=await first(env.DB,"SELECT COUNT(*) AS n FROM ads WHERE "+w.join(" AND "),...a);
   // Only an ACTIVE promotion is treated as paid/VIP. Pending records never get a paid placement.
   // The correlated lookup also keeps this compatible with the existing ads table; no ads columns or data are changed.
   const vipTable=await table(env.DB,"vip_promotions");
   const vipSelect=vipTable?`,(SELECT p.days FROM vip_promotions p WHERE p.ad_id=ads.id AND LOWER(p.status)='active' AND datetime(p.created_at,'+'||p.days||' days')>datetime('now') ORDER BY datetime(p.created_at) DESC,p.id DESC LIMIT 1) AS vip_days,(SELECT p.created_at FROM vip_promotions p WHERE p.ad_id=ads.id AND LOWER(p.status)='active' AND datetime(p.created_at,'+'||p.days||' days')>datetime('now') ORDER BY datetime(p.created_at) DESC,p.id DESC LIMIT 1) AS vip_started_at,(SELECT datetime(p.created_at,'+'||p.days||' days') FROM vip_promotions p WHERE p.ad_id=ads.id AND LOWER(p.status)='active' AND datetime(p.created_at,'+'||p.days||' days')>datetime('now') ORDER BY datetime(p.created_at) DESC,p.id DESC LIMIT 1) AS vip_expires_at`:`,NULL AS vip_days,NULL AS vip_started_at,NULL AS vip_expires_at`;
   const order=url.searchParams.get("sort")==="price_low"||url.searchParams.get("sort")==="price_high"?sort:
     (vipTable?`CASE WHEN EXISTS(SELECT 1 FROM vip_promotions p WHERE p.ad_id=ads.id AND LOWER(p.status)='active' AND datetime(p.created_at,'+'||p.days||' days')>datetime('now')) THEN 1 ELSE 0 END DESC, ads.created_at DESC`:`ads.created_at DESC`);
   const rows=await all(env.DB,"SELECT ads.*"+vipSelect+" FROM ads WHERE "+w.join(" AND ")+` ORDER BY ${order} LIMIT ? OFFSET ?`,...a,limit,(page-1)*limit);
   const ads=rows.map(row=>{
    const days=Number(row.vip_days)||0;
    const started=row.vip_started_at?Date.parse(String(row.vip_started_at).replace(" ","T")+"Z"):0;
    const expires=row.vip_expires_at?Date.parse(String(row.vip_expires_at).replace(" ","T")+"Z"):0;
    return {...row,plan:days?`VIP ${days} Days`:(row.plan||"Free"),vipStartedAt:started||0,vipExpiresAt:expires||0};
   });
   return out({success:true,ads,total:count?.n||0,page,limit});
  }
  if(p==="/api/public/districts"&&req.method==="GET"){
   if(!await table(env.DB,"districts"))return out({success:true,districts:[]});
   const c=await cols(env.DB,"districts"),sort=c.includes("name")?"name":c.includes("district_name")?"district_name":"id";
   return out({success:true,districts:await all(env.DB,`SELECT * FROM districts ORDER BY ${sort}`)});
  } 
   
  if(p==="/api/public/areas"&&req.method==="GET"){const d=str(url.searchParams.get("district"),100);if(!d)return bad("district query parameter is required");return out({success:true,areas:await listAreas(env.DB,d)})}
  const imagePath=p.match(/^\/api\/images\/([a-zA-Z0-9/_-]+)$/);
  if(imagePath&&req.method==="GET"){
   if(!env.IMAGES)return bad("R2 image storage is not configured",503);
   const key=imagePath[1];if(key.includes(".."))return bad("Invalid image key",400);
   const obj=await env.IMAGES.get(key);if(!obj)return bad("Image not found",404);
   const headers=new Headers({"Cache-Control":"public, max-age=86400","Content-Type":obj.httpMetadata?.contentType||"application/octet-stream"});
   return new Response(obj.body,{headers});
  }
  if(p==="/api/admin/images/upload"&&req.method==="POST"){
   if(!await isAdmin(req,env))return bad("Admin login required",401);
   if(!env.IMAGES)return bad("R2 image storage is not configured",503);
   const form=await req.formData(),file=form.get("image")||form.get("file");
   if(!file||typeof file.arrayBuffer!=="function")return bad("Image file is required (field: image)",400);
   const type=String(file.type||"").toLowerCase(),allowed=new Set(["image/jpeg","image/png","image/webp","image/gif"]);
   if(!allowed.has(type))return bad("Only JPG, PNG, WEBP and GIF images are allowed",415);
   if(file.size<=0||file.size>5*1024*1024)return bad("Image must be between 1 byte and 5 MB",413);
   const ext=type==="image/jpeg"?"jpg":type.split("/")[1],key=`ads/${new Date().toISOString().slice(0,10)}/${uid()}.${ext}`;
   await env.IMAGES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:type,cacheControl:"public, max-age=31536000"}});
   return out({success:true,key,url:`${url.origin}/api/images/${key}`,size:file.size,contentType:type},201);
  }
  const imageDelete=p.match(/^\/api\/admin\/images\/(.+)$/);
  if(imageDelete&&req.method==="DELETE"){
   if(!await isAdmin(req,env))return bad("Admin login required",401);
   if(!env.IMAGES)return bad("R2 image storage is not configured",503);
   const key=decodeURIComponent(imageDelete[1]);
   if(!key||key.includes(".."))return bad("Invalid image key",400);
   await env.IMAGES.delete(key);
   return out({success:true,key});
  }
  if(p.startsWith("/api/admin/")&&!await isAdmin(req,env))return bad("Admin login required",401);
  if(p==="/api/admin/districts"&&req.method==="GET"){
   if(!await table(env.DB,"districts"))return bad("Districts table is not available in D1",404);
   const c=await cols(env.DB,"districts"),nameCol=c.includes("name")?"name":c.includes("district_name")?"district_name":null;
   if(!nameCol)return bad("District table must contain name or district_name column",500);
   return out({success:true,districts:await all(env.DB,`SELECT * FROM districts ORDER BY ${nameCol}`)});
  }
  if(p==="/api/admin/districts"&&req.method==="POST"){
   if(!await table(env.DB,"districts"))return bad("Districts table is not available in D1",404);
   const c=await cols(env.DB,"districts"),nameCol=c.includes("name")?"name":c.includes("district_name")?"district_name":null,b=await readBody(req)||{},name=str(b.name,100);
   if(!name)return bad("District name is required");
   if(!nameCol)return bad("District table must contain name or district_name column",500);
   const exists=await first(env.DB,`SELECT id FROM districts WHERE LOWER(${nameCol})=LOWER(?)`,name);
   if(exists)return bad("District already exists",409);
   await run(env.DB,`INSERT INTO districts(${nameCol}) VALUES(?)`,name);
   return out({success:true});
  }
  const districtMatch=p.match(/^\/api\/admin\/districts\/(\d+)$/);
  if(districtMatch&&req.method==="PUT"){
   if(!await table(env.DB,"districts"))return bad("Districts table is not available in D1",404);
   const c=await cols(env.DB,"districts"),nameCol=c.includes("name")?"name":c.includes("district_name")?"district_name":null,b=await readBody(req)||{},name=str(b.name,100);
   if(!name)return bad("District name is required");
   if(!nameCol)return bad("District table must contain name or district_name column",500);
   await run(env.DB,`UPDATE districts SET ${nameCol}=? WHERE id=?`,name,districtMatch[1]);
   return out({success:true});
  }
  if(districtMatch&&req.method==="DELETE"){
   if(!await table(env.DB,"districts"))return bad("Districts table is not available in D1",404);
   if(await table(env.DB,"areas")){
    const ac=await cols(env.DB,"areas");
    if(ac.includes("district_id")){
     const used=await first(env.DB,"SELECT COUNT(*) AS n FROM areas WHERE district_id=?",districtMatch[1]);
     if(Number(used?.n)>0)return bad("This district still has areas. Remove or move its areas first.",409);
    }
   }
   await run(env.DB,"DELETE FROM districts WHERE id=?",districtMatch[1]);
   return out({success:true});
  }
  if(p==="/api/admin/dashboard"&&req.method==="GET"){
   const [a,k]=await Promise.all([first(env.DB,"SELECT COUNT(*) n FROM ads"),first(env.DB,"SELECT COUNT(*) n FROM categories")]);
   return out({success:true,stats:{ads:a.n,categories:k.n}});
  }
  if(p==="/api/admin/categories"&&req.method==="GET")return out({success:true,categories:await all(env.DB,"SELECT * FROM categories ORDER BY sort_order,id")});
  if(p==="/api/admin/categories"&&req.method==="POST"){
   const b=await readBody(req)||{},name=str(b.name,80),slug=str(b.slug||name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),100);if(!name||!slug)return bad("Category name and slug required");
   await run(env.DB,"INSERT INTO categories(name,slug,parent_id,icon,sort_order,active,created_at) VALUES(?,?,?,?,?,?,datetime('now'))",name,slug,b.parent_id||null,str(b.icon||"◆",20),Number(b.sort_order)||0,b.active===false?0:1);return out({success:true});
  }
  const cat=p.match(/^\/api\/admin\/categories\/(\d+)$/);
  if(cat&&req.method==="PUT"){const b=await readBody(req)||{};await run(env.DB,"UPDATE categories SET name=?,slug=?,parent_id=?,icon=?,sort_order=?,active=? WHERE id=?",str(b.name,80),str(b.slug,100),b.parent_id||null,str(b.icon||"◆",20),Number(b.sort_order)||0,b.active===false?0:1,cat[1]);return out({success:true})}
  if(cat&&req.method==="DELETE"){await run(env.DB,"DELETE FROM categories WHERE parent_id=?",cat[1]);await run(env.DB,"DELETE FROM categories WHERE id=?",cat[1]);return out({success:true})}
  if(p==="/api/admin/ads"&&req.method==="GET")return out({success:true,ads:await all(env.DB,"SELECT * FROM ads ORDER BY created_at DESC LIMIT 500")});
  if(p==="/api/admin/ads"&&req.method==="POST"){
    const b=await readBody(req)||{},a=safeAd(b,null,"approved");
    if(!a.title||!a.category||!a.district)return bad("Ad title, category and district are required");
    await saveAd(env.DB,a);
    let vipAmount=700;
    const pricing=await first(env.DB,"SELECT value FROM settings WHERE key='vip_pricing'");
    if(pricing?.value){try{vipAmount=Number(JSON.parse(pricing.value)["7"]??700)||700}catch{}}
    await run(env.DB,"INSERT INTO vip_promotions(ad_id,days,amount,status,reference,created_at) VALUES(?,?,?,?,?,datetime('now'))",a.id,7,vipAmount,"active","ADMIN_AUTO_VIP");
    return out({success:true,id:a.id,status:"approved",plan:"VIP 7 Days",message:"Advertisement published with VIP card for 7 days"})
   }
  if(p==="/api/admin/ads/bulk"&&req.method==="POST"){
   const b=await readBody(req)||{},action=str(b.action||"create",20),items=Array.isArray(b.ads)?b.ads:[];
   if(action==="create"){
    if(!items.length||items.length>100)return bad("Provide between 1 and 100 ads");
    const created=[];
    for(const item of items){
     const a=safeAd(item,null,"approved");
     if(!a.title||!a.category||!a.district)return bad("Every ad requires title, category and district");
     await saveAd(env.DB,a);
     let amount=700;const pricing=await first(env.DB,"SELECT value FROM settings WHERE key='vip_pricing'");
     if(pricing?.value){try{amount=Number(JSON.parse(pricing.value)["7"]??700)||700}catch{}}
     await run(env.DB,"INSERT INTO vip_promotions(ad_id,days,amount,status,reference,created_at) VALUES(?,?,?,?,?,datetime('now'))",a.id,7,amount,"active","ADMIN_BULK_VIP");
     created.push(a.id);
    }
    return out({success:true,created:created.length,ids:created},201);
   }
   const ids=Array.isArray(b.ids)?b.ids.map(x=>str(x,100)).filter(Boolean):[];
   if(!ids.length||ids.length>500)return bad("Provide between 1 and 500 ad IDs");
   if(action==="delete"){
    for(const id of ids){const row=await first(env.DB,"SELECT image_url FROM ads WHERE id=?",id);if(row?.image_url&&env.IMAGES){const m=String(row.image_url).match(/\/api\/images\/(.+)$/);if(m)await env.IMAGES.delete(m[1]).catch(()=>{});}await run(env.DB,"DELETE FROM ads WHERE id=?",id);}
    return out({success:true,deleted:ids.length});
   }
   if(action==="status"){
    if(!["approved","paused","rejected","pending"].includes(b.status))return bad("Invalid bulk ad status");
    for(const id of ids)await run(env.DB,"UPDATE ads SET status=? WHERE id=?",b.status,id);
    return out({success:true,updated:ids.length,status:b.status});
   }
   return bad("Bulk action must be create, delete or status");
  }
  const ad=p.match(/^\/api\/admin\/ads\/([^/]+)$/);
  if(ad&&req.method==="PATCH"){const b=await readBody(req)||{};if(b.status){if(!["pending","approved","rejected","paused"].includes(b.status))return bad("Invalid ad status");await run(env.DB,"UPDATE ads SET status=? WHERE id=?",b.status,ad[1])}else{const a=safeAd(b,null);await run(env.DB,"UPDATE ads SET title=?,description=?,category=?,district=?,area=?,price=?,phone=?,whatsapp=?,image_url=? WHERE id=?",a.title,a.description,a.category,a.district,a.area,a.price,a.phone,a.whatsapp,a.image_url,ad[1])}return out({success:true})}
  if(ad&&req.method==="DELETE"){
   const adRow=await first(env.DB,"SELECT image_url FROM ads WHERE id=?",ad[1]);
   if(adRow?.image_url&&env.IMAGES){const m=String(adRow.image_url).match(/\/api\/images\/(.+)$/);if(m)await env.IMAGES.delete(m[1]).catch(()=>{});}
   await run(env.DB,"DELETE FROM ads WHERE id=?",ad[1]);return out({success:true})
  }
  if(p==="/api/admin/settings"&&req.method==="GET"){const rows=await all(env.DB,"SELECT key,value FROM settings"),settings={};for(const r of rows){try{settings[r.key]=JSON.parse(r.value)}catch{settings[r.key]=r.value}}return out({success:true,settings})}
  if(p==="/api/admin/settings"&&req.method==="PUT"){const b=await readBody(req)||{};for(const [k,v] of Object.entries(b))await run(env.DB,"INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",str(k,80),JSON.stringify(v));return out({success:true})}
  if(p==="/api/admin/contact-settings"&&req.method==="GET"){
   const row=await first(env.DB,"SELECT value FROM settings WHERE key='contact_buttons'");
   let settings={call:true,whatsapp:true};
   if(row?.value){try{settings={...settings,...JSON.parse(row.value)}}catch{}}
   return out({success:true,settings});
  }
  if(p==="/api/admin/contact-settings"&&req.method==="PUT"){
   const b=await readBody(req)||{},settings={call:b.call!==false,whatsapp:b.whatsapp!==false};
   await run(env.DB,"INSERT INTO settings(key,value) VALUES('contact_buttons',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify(settings));
   return out({success:true,settings});
  }

  if(p==="/api/admin/form-fields"&&req.method==="GET")return out({success:true,fields:await all(env.DB,"SELECT * FROM form_fields ORDER BY sort_order,id")});
  if(p==="/api/admin/form-fields"&&req.method==="POST"){const b=await readBody(req)||{};if(!str(b.label,100))return bad("Field label required");await run(env.DB,"INSERT INTO form_fields(label,field_type,required,options_json,sort_order,active) VALUES(?,?,?,?,?,1)",str(b.label,100),str(b.field_type||"text",30),b.required?1:0,JSON.stringify(Array.isArray(b.options)?b.options:[]),Number(b.sort_order)||0);return out({success:true})}
  const formField=p.match(/^\/api\/admin\/form-fields\/(\d+)$/);
  if(formField&&req.method==="DELETE"){await run(env.DB,"DELETE FROM form_fields WHERE id=?",formField[1]);return out({success:true})}
  const vipActivate=p.match(/^\/api\/admin\/vip\/(\d+)\/activate$/);
  if(vipActivate&&req.method==="POST"){
   const id=Number(vipActivate[1]);
   const promo=await first(env.DB,"SELECT id,ad_id,days,status FROM vip_promotions WHERE id=?",id);
   if(!promo)return bad("VIP promotion record not found",404);
   const ad=await first(env.DB,"SELECT id,status FROM ads WHERE id=?",promo.ad_id);
   if(!ad||ad.status!=="approved")return bad("Only a published ad can be activated as VIP",400);
   await run(env.DB,"UPDATE vip_promotions SET status='active',created_at=datetime('now') WHERE id=?",id);
   return out({success:true,status:"active",message:"VIP placement activated. Confirm payment before using this action."});
  }
  if(p==="/api/admin/vip"&&req.method==="GET")return out({success:true,promotions:await all(env.DB,"SELECT * FROM vip_promotions ORDER BY created_at DESC LIMIT 200")});
  if(p==="/api/admin/vip"&&req.method==="POST"){const b=await readBody(req)||{},days=Number(b.days)||3,amount=Number(b.amount)||0;if(![3,5,7].includes(days)||amount<0)return bad("Invalid VIP promotion plan");await run(env.DB,"INSERT INTO vip_promotions(ad_id,days,amount,status,reference,created_at) VALUES(?,?,?,?,?,datetime('now'))",str(b.ad_id,100),days,amount,"pending",str(b.reference,120));return out({success:true})}
  return bad("API route not found",404);
 }catch(e){console.error("HEY MR API error",e);return bad("Internal server error. Check Worker logs.",500)}
}};
