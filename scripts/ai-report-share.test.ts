import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {publication,pageHTML,owner,readShareBody,ShareError} from '../lib/ai-report/contract'
const credentials={owner_token:'a'.repeat(64),report_id:'synthetic-report'}
const jpeg=async()=> (await sharp({create:{width:20,height:30,channels:3,background:'#ffffff'}}).jpeg().toBuffer()).toString('base64')
test('anonymous publication preserves document and exact native JPEG',async()=>{
 const image=await jpeg(),document={title:'整改日报',summary:'概述',photoComparisons:[{beforeFile:'b.jpg',afterFile:'a.jpg'}]}
 const value=await publication({...credentials,revision:2,language:'zh-Hans',document,pages:[image]})
 assert.equal(value.pages[0].jpeg.toString('base64'),image);assert.deepEqual(value.document,document);assert.equal(value.pages[0].height,30);assert.notEqual(value.ownerHash,credentials.owner_token)
 const retry=await publication({...credentials,revision:2,language:'zh-Hans',document,pages:[image]});assert.equal(value.contentHash,retry.contentHash)
})
test('reject malformed identities, unbounded documents, bad images and empty reports',async()=>{
 assert.throws(()=>owner({...credentials,owner_token:'guess'}),ShareError)
 for(const values of [{revision:-1},{pages:[]},{pages:['not-a-jpeg']},{document:{title:''}},{document:{title:'X',text:'a'.repeat(256001)}}])await assert.rejects(publication({...credentials,revision:1,document:{title:'X'},pages:[await jpeg()],...values}),ShareError)
})
test('public HTML escapes all user content and needs no login or JavaScript',()=>{
 const html=pageHTML({shareKey:'b'.repeat(48),title:'<script>alert(1)</script>',language:'zh-Hans',revision:3,document:{summary:'<img src=x onerror=alert(1)>'},pages:[{position:0,width:430,height:2000}]})
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('width="430" height="2000"'));assert.ok(html.includes('/pages/0?v=3'));assert.ok(!html.includes('login'));assert.ok(html.includes('noindex'))
})
test('body parser does not require an authorization header',async()=>{
 const request=new Request('https://example.test/api/ai-report/share/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)})
 assert.deepEqual(await readShareBody(request),credentials)
})
