import {randomBytes} from 'node:crypto'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {owner,publication,ShareError} from './contract'
export async function publishReport(body:Record<string,unknown>){
 const input=await publication(body)
 for(let attempt=0;attempt<3;attempt++)try{return await prisma.$transaction(async tx=>{
  const existing=await tx.aIReportShare.findUnique({where:{ownerHash_reportId:{ownerHash:input.ownerHash,reportId:input.reportId}}})
  if(existing && (existing.revision>input.revision || (existing.revision===input.revision && existing.contentHash!==input.contentHash)))throw new ShareError('Report revision changed',409)
  if(existing && existing.revision===input.revision && !existing.closedAt)return existing
  if(!existing && await tx.aIReportShare.count({where:{ownerHash:input.ownerHash,createdAt:{gte:new Date(Date.now()-86400000)}}})>=50)throw new ShareError('Publication limit reached',429)
  const data={revision:input.revision,contentHash:input.contentHash,title:input.title,language:input.language,document:input.document as Prisma.InputJsonValue,closedAt:null}
  const record=existing ? await tx.aIReportShare.update({where:{id:existing.id},data}) : await tx.aIReportShare.create({data:{...data,ownerHash:input.ownerHash,reportId:input.reportId,shareKey:randomBytes(24).toString('hex')}})
  await tx.aIReportSharePage.deleteMany({where:{shareId:record.id}})
  for(const [position,page]of input.pages.entries())await tx.aIReportSharePage.create({data:{shareId:record.id,position,...page}})
  return record
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)&&attempt<2)continue;throw error}
 throw new ShareError('Retry publication',503)
}
export async function closeReport(body:Record<string,unknown>){
 const identity=owner(body)
 // A guessed report id is not sufficient: only the device's unshared capability can close it.
 await prisma.aIReportShare.updateMany({where:identity,data:{closedAt:new Date()}})
}
export const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}
export function failure(error:unknown){return Response.json({error:error instanceof ShareError?error.message:'Unable to share report'},{status:error instanceof ShareError?error.status:500,headers})}
const requests=new Map<string,{start:number,count:number}>()
export function throttle(req:Request){
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown',now=Date.now()
 for(const [key,v]of requests)if(now-v.start>3600000)requests.delete(key)
 const value=requests.get(ip)||{start:now,count:0};if(++value.count>60)throw new ShareError('Please try later',429);requests.set(ip,value)
}
