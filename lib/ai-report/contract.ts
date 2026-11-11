import {createHash} from 'node:crypto'
import sharp from 'sharp'
export class ShareError extends Error {constructor(message:string,readonly status=400){super(message)}}
export const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex')
export function owner(body:Record<string,unknown>){
 if(typeof body.owner_token!=='string'||!/^[a-f0-9]{64}$/.test(body.owner_token))throw new ShareError('Invalid owner token')
 if(typeof body.report_id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(body.report_id))throw new ShareError('Invalid report id')
 return {ownerHash:hash(body.owner_token),reportId:body.report_id}
}
export async function readShareBody(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ShareError('JSON required',415)
 const reader=request.body?.getReader();if(!reader)throw new ShareError('Missing body')
 const chunks:Uint8Array[]=[];let length=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>32*1024*1024)throw new ShareError('Report too large',413);chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new ShareError('Invalid JSON')}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new ShareError('Invalid body');return body as Record<string,unknown>
}
export async function publication(body:Record<string,unknown>){
 const identity=owner(body)
 if(!Number.isSafeInteger(body.revision)||Number(body.revision)<0||Number(body.revision)>2147483647)throw new ShareError('Invalid revision')
 const document=body.document
 if(!document||typeof document!=='object'||Array.isArray(document)||JSON.stringify(document).length>256000)throw new ShareError('Invalid report document')
 const d=document as Record<string,unknown>,title=typeof d.title==='string'?d.title.trim():''
 if(!title||title.length>500)throw new ShareError('Invalid title')
 const language=typeof body.language==='string'&&/^[a-zA-Z0-9-]{2,32}$/.test(body.language)?body.language:'en'
 if(!Array.isArray(body.pages)||body.pages.length<1||body.pages.length>16)throw new ShareError('Invalid pages')
 const pages=[];let total=0
 for(const raw of body.pages){
  if(typeof raw!=='string'||raw.length>14*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw new ShareError('Invalid image')
  const jpeg=Buffer.from(raw,'base64');total+=jpeg.length
  if(jpeg.length>10*1024*1024||total>24*1024*1024)throw new ShareError('Report too large',413)
  try{const metadata=await sharp(jpeg,{limitInputPixels:40000000}).metadata();if(metadata.format!=='jpeg'||!metadata.width||!metadata.height||metadata.width*metadata.height>40000000)throw Error();await sharp(jpeg,{limitInputPixels:40000000}).stats();pages.push({width:metadata.width,height:metadata.height,jpeg})}catch{throw new ShareError('Invalid JPEG')}
 }
 const contentHash=hash(JSON.stringify({document,language,images:pages.map(p=>hash(p.jpeg))}))
 return {...identity,revision:Number(body.revision),title,language,document,contentHash,pages}
}
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function pageHTML(share:{shareKey:string,title:string,language:string,revision:number,document:unknown,pages:{position:number,width:number,height:number}[]}){
 const d=share.document as Record<string,unknown>
 const text=[share.title,d.date,d.reporter,d.project,d.summary,...(Array.isArray(d.rows)?d.rows.flatMap((row:Record<string,unknown>)=>[row.title,row.body,row.detail]):[]),d.followup,d.workSupplement].filter(v=>typeof v==='string').map(v=>`<p>${escape(v)}</p>`).join('')
 return `<!doctype html><html lang="${escape(share.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escape(share.title)} · TIMEPrint</title><meta property="og:title" content="${escape(share.title)}"><meta property="og:type" content="article"><style>html,body{margin:0;background:#f2f2f7}main{max-width:860px;margin:0 auto;background:white}img{display:block;width:100%;height:auto}article{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}@media print{html,body{background:white}main{max-width:none}}</style></head><body><main aria-label="${escape(share.title)}">${share.pages.map(p=>`<img src="/report/${share.shareKey}/pages/${p.position}?v=${share.revision}" width="${p.width}" height="${p.height}" alt="" ${p.position?'loading="lazy"':''}>`).join('')}<article>${text}</article></main></body></html>`
}
