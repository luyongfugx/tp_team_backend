import {prisma} from '@/lib/prisma'
import {headers} from '@/lib/ai-report/service'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(req:Request,{params}:{params:Promise<{key:string,index:string}>}){
 const {key,index}=await params
 if(!/^[a-f0-9]{48}$/.test(key)||!/^\d{1,2}$/.test(index))return new Response(null,{status:404,headers})
 const version=Number(new URL(req.url).searchParams.get("v"));if(!Number.isSafeInteger(version)||version<0)return new Response(null,{status:404,headers})
 const page=await prisma.aIReportSharePage.findFirst({where:{position:Number(index),share:{shareKey:key,closedAt:null,revision:version}},select:{jpeg:true}})
 if(!page)return new Response(null,{status:404,headers})
 return new Response(new Uint8Array(page.jpeg),{headers:{...headers,'Content-Type':'image/jpeg'}})
}
