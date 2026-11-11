import {readShareBody} from '@/lib/ai-report/contract'
import {closeReport,headers,failure} from '@/lib/ai-report/service'
export const runtime='nodejs'
export async function POST(req:Request){try{await closeReport(await readShareBody(req));return Response.json({closed:true},{headers})}catch(error){return failure(error)}}
