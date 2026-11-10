import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import sharp from 'sharp'
async function main(){
const base=process.env.REPORT_TEST_ORIGIN || 'http://127.0.0.1:3317'
const token=randomBytes(32).toString('hex'),id='audit-'+randomBytes(12).toString('hex')
const image=await sharp({create:{width:430,height:600,channels:3,background:'#e8f0ff'}}).jpeg().toBuffer()
const body={report_id:id,owner_token:token,revision:1,language:'zh-Hans',document:{title:'Synthetic report link audit',summary:'Synthetic data only',rows:[{title:'Work',body:'Test'}]},pages:[image.toString('base64')]}
async function post(action:string,value:unknown){return fetch(`${base}/api/ai-report/share/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)})}
let publicPath=''
try{
 const created=await post('publish',body);assert.equal(created.status,200,await created.clone().text());const receipt=await created.json();publicPath=new URL(receipt.url).pathname
 assert.match(publicPath,/^\/report\/[a-f0-9]{48}$/)
 const retry=await (await post('publish',body)).json();assert.equal(retry.url,receipt.url)
 const page=await fetch(base+publicPath);assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('Synthetic report link audit'));assert.ok(!html.includes(token));assert.ok(page.headers.get('content-security-policy')?.includes("default-src 'none'"))
 const photo=await fetch(base+publicPath+'/pages/0?v=1');assert.equal(photo.status,200);assert.deepEqual(Buffer.from(await photo.arrayBuffer()),image)
 await post('close',{report_id:id,owner_token:randomBytes(32).toString('hex')});assert.equal((await fetch(base+publicPath)).status,200)
 assert.equal((await post('publish',{...body,document:{title:'Conflict'}})).status,409)
 const updated=await (await post('publish',{...body,revision:2,document:{...body.document,summary:'Updated'}})).json();assert.equal(updated.url,receipt.url)
 assert.equal((await post('publish',body)).status,409)
 assert.equal((await fetch(base+publicPath+'/pages/0?v=1')).status,404)
 await post('close',{report_id:id,owner_token:token});assert.equal((await fetch(base+publicPath)).status,404);assert.equal((await fetch(base+publicPath+'/pages/0?v=2')).status,404)
 console.log('PASS: anonymous publication, stable unique URL, exact native JPEG, owner-only close, revision conflicts and full revocation')
}finally{
 await post('close',{report_id:id,owner_token:token}).catch(()=>{})
 if(process.env.REPORT_TEST_CLEANUP==='1'){const {prisma}=await import('../lib/prisma');await prisma.aIReportShare.deleteMany({where:{reportId:id}});await prisma.$disconnect()}
}

}
main().catch(error=>{console.error(error);process.exitCode=1})
