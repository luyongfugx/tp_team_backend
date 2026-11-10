import {prisma} from '@/lib/prisma'
import {pageHTML} from '@/lib/ai-report/contract'
import {headers} from '@/lib/ai-report/service'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(_req:Request,{params}:{params:Promise<{key:string}>}){
 const {key}=await params
 if(!/^[a-f0-9]{48}$/.test(key))return new Response('Report unavailable',{status:404,headers})
 const share=await prisma.aIReportShare.findUnique({where:{shareKey:key},include:{pages:{select:{position:true,width:true,height:true},orderBy:{position:'asc'}}}})
 if(!share||share.closedAt)return new Response('Report unavailable',{status:404,headers})
 return new Response(pageHTML(share),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}})
}
