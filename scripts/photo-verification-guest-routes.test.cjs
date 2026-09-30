const assert = require('node:assert/strict')
const { test } = require('node:test')
const Module = require('node:module')
const originalLoad = Module._load
let currentUser = null
const tasks = new Map()
const matches = (row, where) => Object.entries(where).every(([k,v]) => typeof v === 'object' && v !== null ? v.in.includes(row[k]) : row[k] === v)
const database = {
  create: async ({data}) => { const row = {userID:null, ...data}; tasks.set(row.taskID,row); return row },
  findUnique: async ({where}) => tasks.get(where.taskID),
  findFirst: async ({where}) => [...tasks.values()].find(row => matches(row,where)),
  updateMany: async ({where,data}) => { let count=0; for(const row of tasks.values()) if(matches(row,where)){ Object.assign(row,data);count++ } return {count} },
}
Module._load = function(request, parent, isMain) {
  if (request === '@/app/api/_utils/api') return {
    requireUser: async () => currentUser, readBody: async req => req.json(),
    bad: (error,status=400) => Response.json({error},{status}), ok: data => Response.json(data),
  }
  if (request === '@/lib/prisma') return {prisma:{photoVerificationTask:database}}
  if (request === '@/lib/photoVerification') {
    const actual = originalLoad.call(this, require.resolve('../lib/photoVerification.ts'), parent,isMain)
    return {...actual, submitPhotoVerificationTask:async()=>{}}
  }
  return originalLoad.call(this, request,parent,isMain)
}
const create = require('../app/api/photoCode/verify/task/route.ts').POST
const status = require('../app/api/photoCode/verify/task/status/route.ts').POST
const timeout = require('../app/api/photoCode/verify/task/timeout/route.ts').POST
const guest = 'caab00a1-4702-441e-839f-1e99c7dad2f0'
const other = 'dcab00a1-4702-441e-839f-1e99c7dad2f0'
const request = body => new Request('http://localhost/api/test',{method:'POST',body:JSON.stringify(body)})
test('guest create/poll/timeout routes enforce ownership without requiring login', async () => {
  process.env.TENCENT_COS_BUCKETS_JSON=JSON.stringify({verify_images:{bucket:'test',region:'ap-singapore'}})
  const imageUrl=`https://test.cos.ap-singapore.myqcloud.com/verify/guest-${guest}/${other}.jpg`
  assert.equal((await create(request({imageUrl}))).status,400)
  const created = await create(request({imageUrl,guestToken:guest}))
  assert.equal(created.status,200)
  const payload = await created.json()
  assert.equal(JSON.stringify(payload).includes('guestKey'),false)
  const taskID=payload.taskID
  assert.ok(taskID)
  assert.equal((await status(request({taskID,guestToken:guest}))).status,200)
  assert.equal((await status(request({taskID,guestToken:other}))).status,404)
  assert.equal((await timeout(request({taskID,guestToken:other}))).status,404)
  currentUser={id:'account-a'}
  assert.equal((await status(request({taskID,guestToken:guest}))).status,404)
  tasks.set('account-task',{taskID:'account-task',userID:'account-a',status:'PROCESSING'})
  assert.equal((await status(request({taskID:'account-task'}))).status,200)
  currentUser=null
  assert.equal((await status(request({taskID:'account-task',guestToken:guest}))).status,404)
  assert.equal((await timeout(request({taskID,guestToken:guest}))).status,200)
  assert.equal(tasks.get(taskID).status,'FAILED')
})
