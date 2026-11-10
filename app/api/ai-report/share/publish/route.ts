import {readShareBody} from '@/lib/ai-report/contract'
import {publishReport,headers,failure,throttle} from '@/lib/ai-report/service'
export const runtime='nodejs'
export async function POST(req:Request){try{
 throttle(req);const report=await publishReport(await readShareBody(req))
 const origin=process.env.AI_REPORT_PUBLIC_ORIGIN || 'https://teamspace.timeprint.net'
 return Response.json({url:`${origin}/report/${report.shareKey}`,share_key:report.shareKey,revision:report.revision,published_at:report.updatedAt.getTime()/1000,provider:'team_backend'},{headers})
}catch(error){return failure(error)}}
