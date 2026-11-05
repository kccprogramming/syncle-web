import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333',team='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const start='2030-11-10T19:00:00+09:00',end='2030-11-10T20:00:00+09:00';
const id=`time:${start}/${end}`;
async function dbFixture(){
 const db=new PGlite();await db.exec(`
 create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key);
 create table public.teams(id uuid primary key);
 create table public.team_members(team_id uuid references public.teams(id),member_id uuid references auth.users(id),member_role text);
 create table public.messages(id uuid default gen_random_uuid(),team_id uuid,sender_id uuid,content text,message_type text,visible_to uuid[]);
 create table public.app_notifications(recipient_id uuid);
 create function public.is_team_member(t uuid) returns boolean language sql security definer as $$select exists(select 1 from public.team_members where team_id=t and member_id=auth.uid())$$;
 create function public.is_team_owner(t uuid) returns boolean language sql security definer as $$select exists(select 1 from public.team_members where team_id=t and member_id=auth.uid() and member_role='owner')$$;
 create function public.create_team_notification(t uuid,r uuid,ty text,ti text,b text,ref text) returns uuid language plpgsql security definer as $$begin insert into public.app_notifications values(r);return gen_random_uuid();end$$;
 create function public.create_confirmed_message(t uuid,content text,recipients uuid[] default null) returns uuid language plpgsql security definer as $$declare new_id uuid;begin if not public.is_team_owner(t) then raise exception 'OWNER_REQUIRED'; end if; insert into public.messages(team_id,sender_id,content,message_type,visible_to) values(t,auth.uid(),content,'confirmed',recipients) returning id into new_id; return new_id;end$$;
 insert into auth.users values('${owner}'),('${member}'),('${outsider}');insert into public.teams values('${team}');
 insert into public.team_members values('${team}','${owner}','owner'),('${team}','${member}','member');
 `);
 await db.exec(readFileSync('supabase/c-scheduling-review.sql','utf8'));
 const call=async<T=any>(who:string|null,fn:string,args:unknown[])=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who??'']);await db.exec('set role authenticated');const r=await db.query<{value:T}>(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args);return r.rows[0].value};
 const state={title:'테스트 회의',mode:'online',responseDeadline:'2030-11-09T18:00:00+09:00',materialDeadline:'2030-11-10T18:00:00+09:00',conditions:{purpose:'테스트 회의',meetingMode:'online',agenda:[],sourceMessageIds:[],origins:[{memberId:owner,station:'정확한 비공개 출발지'}],placeRequirements:[],schedule:{teamId:team,timezone:'Asia/Seoul',searchWindow:{startAt:'2030-11-10T00:00:00+09:00',endAt:'2030-11-11T00:00:00+09:00'},durationMinutes:60,requiredMemberIds:[owner,member],members:[owner,member].map(memberId=>({memberId,responseStatus:'provided',availableSlots:[{startAt:start,endAt:end}],unavailableSlots:[]}))}},candidates:[{id,startAt:start,endAt:end}]};
 const create=()=>call(owner,'c_schedule_create',[team,state,[]]);
 return{db,call,state,create};
}

test('DB: authorization, atomic confirmation, private cards, responses and stale writes',async()=>{
 const {db,call,state,create}=await dbFixture();try{
  await assert.rejects(call(outsider,'c_schedule_create',[team,state,[]]),/C_FORBIDDEN/);
  await assert.rejects(call(null,'c_schedule_create',[team,state,[]]),/C_FORBIDDEN/);
  const p=await create();assert.deepEqual(p.conditions.origins,[]);
  await assert.rejects(call(outsider,'c_schedule_get',[p.id]),/C_FORBIDDEN/);
  await assert.rejects(call(member,'c_schedule_action',[p.id,'confirm',{candidateId:id},0]),/C_OWNER_REQUIRED/);
  await assert.rejects(call(owner,'c_schedule_action',[p.id,'confirm',{candidateId:id,allowPartial:true},0]),/C_NO_CONFIRMED_ATTENDEES/);
  await assert.rejects(call(member,'c_schedule_action',[p.id,'respond',{kind:'selected',selectedCandidateIds:['fake'],customSlots:[]},0]),/C_INVALID_RESPONSE/);
  const selected=await call(member,'c_schedule_action',[p.id,'respond',{kind:'selected',selectedCandidateIds:[id],customSlots:[],memberId:owner},0]);
  assert.equal(selected.responses[0].memberId,member);assert.equal(selected.version,1);
  await assert.rejects(call(owner,'c_schedule_action',[p.id,'respond',{kind:'declined_all',selectedCandidateIds:[],customSlots:[]},0]),/C_STALE_VERSION/);
  await assert.rejects(call(owner,'c_schedule_action',[p.id,'confirm',{candidateId:id},1]),/C_PARTIAL_CONFIRMATION_REQUIRED/);
  const changed=await call(member,'c_schedule_action',[p.id,'respond',{kind:'declined_all',selectedCandidateIds:[],customSlots:[]},1]);assert.equal(changed.responses.length,1);assert.equal(changed.responses[0].kind,'declined_all');
  const own=await call(owner,'c_schedule_action',[p.id,'respond',{kind:'selected',selectedCandidateIds:[id],customSlots:[]},2]);
  const done=await call(owner,'c_schedule_action',[p.id,'confirm',{candidateId:id,allowPartial:true},own.version]);assert.deepEqual(done.meeting.attendeeIds,[owner]);
  await assert.rejects(call(owner,'c_schedule_action',[p.id,'confirm',{candidateId:id,allowPartial:true},done.version]),/C_ALREADY_CONFIRMED/);
  await db.exec('reset role');const cards=await db.query<{n:number}>("select count(*)::int n from public.messages where message_type='confirmed'");assert.equal(cards.rows[0].n,1);
  const privateP=await call(owner,'c_schedule_create',[team,state,[{targetMemberId:member,question:'응답해 주세요'}]]);
  await db.exec('reset role');const privateRows=await db.query<{visible_to:string[],content:string}>("select visible_to,content from public.messages where message_type='confirmation_question'");assert.deepEqual(privateRows.rows[0].visible_to,[member]);assert.equal(JSON.parse(privateRows.rows[0].content).proposalId,privateP.id);
  await db.exec('set role authenticated');await assert.rejects(db.query('select * from scheduling.proposals'),/permission denied/);
 }finally{await db.close()}
});

test('DB: deadlines, custom slots, mode permissions, reminders and place failure retention',async()=>{
 const {db,call,state,create}=await dbFixture();try{
  const expired=structuredClone(state);expired.responseDeadline='2000-01-01T00:00:00Z';await assert.rejects(call(owner,'c_schedule_create',[team,expired,[]]),/C_INVALID_INPUT/);
  const p=await create();await assert.rejects(call(member,'c_schedule_action',[p.id,'mode',{mode:'offline'},0]),/C_OWNER_REQUIRED/);
  await assert.rejects(call(owner,'c_schedule_action',[p.id,'mode',{mode:'online',meetingUrl:'javascript:alert(1)'},0]),/C_INVALID_URL/);
  const link=await call(owner,'c_schedule_action',[p.id,'mode',{mode:'online',meetingUrl:'https://example.com/meeting'},0]);assert.equal(link.meetingUrl,'https://example.com/meeting');
  const reminded=await call(owner,'c_schedule_action',[p.id,'remind',{},link.version]);assert.equal(reminded.notifiedCount,2);
  await assert.rejects(call(owner,'c_schedule_action',[p.id,'remind',{},reminded.version]),/C_REMINDER_THROTTLED/);
  const s={startAt:start,endAt:end};const custom=await call(member,'c_schedule_action',[p.id,'respond',{kind:'custom',selectedCandidateIds:[],customSlots:[s],extraCandidates:[]},reminded.version]);assert.equal(custom.responses[0].kind,'custom');
  const offline=await call(owner,'c_schedule_action',[p.id,'mode',{mode:'offline'},custom.version]);
  const failed=await call(owner,'c_schedule_action',[p.id,'places',{results:[{timeOptionId:id,status:'error',places:[],error:{code:'KAKAO_QUOTA_EXCEEDED',message:'한도 초과'}}],progress:{step:'partial-fail'}},offline.version]);assert.equal(failed.candidates.length,1);assert.equal(failed.responses.length,1);assert.equal(failed.progress.step,'partial-fail');
  await db.exec('reset role');await db.query("update scheduling.proposals set state=jsonb_set(state,'{responseDeadline}',to_jsonb('2000-01-01T00:00:00Z'::text)) where id=$1",[p.id]);
  await assert.rejects(call(member,'c_schedule_action',[p.id,'respond',{kind:'declined_all',selectedCandidateIds:[],customSlots:[]},failed.version]),/C_RESPONSE_CLOSED/);
 }finally{await db.close()}
});

test('DB: only the owner can replace a selected time place result; other times remain',async()=>{
 const {db,call,state}=await dbFixture();try{
  const anotherStart='2030-11-10T20:00:00+09:00',anotherEnd='2030-11-10T21:00:00+09:00';
  const anotherId=`time:${anotherStart}/${anotherEnd}`;
  const withTwo=structuredClone(state);
  withTwo.candidates.push({id:anotherId,startAt:anotherStart,endAt:anotherEnd});
  const p=await call(owner,'c_schedule_create',[team,withTwo,[]]);
  const offline=await call(owner,'c_schedule_action',[p.id,'mode',{mode:'offline'},p.version]);
  const first={timeOptionId:id,status:'ok',places:[{id:'place-a',name:'A',url:null,rank:1}]};
  await assert.rejects(call(member,'c_schedule_action',[p.id,'places',{results:[first]},offline.version]),/C_OWNER_REQUIRED/);
  const placed=await call(owner,'c_schedule_action',[p.id,'places',{results:[first]},offline.version]);
  const second={timeOptionId:anotherId,status:'error',places:[]};
  const both=await call(owner,'c_schedule_action',[p.id,'places',{results:[second]},placed.version]);
  assert.deepEqual(new Set(both.placeResults.map((r:any)=>r.timeOptionId)),new Set([id,anotherId]));
  assert.equal(both.progress.step,'partial-fail');
  const replaced=await call(owner,'c_schedule_action',[p.id,'places',{results:[{timeOptionId:id,status:'ok',places:[{id:'unranked',name:'U',rank:null}]}]},both.version]);
  assert.equal(replaced.placeResults.length,2);
  assert.equal(replaced.placeResults.find((r:any)=>r.timeOptionId===id).places[0].id,'unranked');
  const responded=await call(owner,'c_schedule_action',[p.id,'respond',{kind:'selected',selectedCandidateIds:[id],customSlots:[]},replaced.version]);
  await assert.rejects(call(owner,'c_schedule_action',[p.id,'confirm',{candidateId:id,placeId:'unranked',allowPartial:true},responded.version]),/C_PLACE_REQUIRED/);
 }finally{await db.close()}
});

test('DB: nested origin aliases and provider extras never enter stored proposals',async()=>{
 const {db,call,state}=await dbFixture();try{
  const untrusted=structuredClone(state) as any;
  untrusted.conditions.schedule.members[0].homeAddress='비공개 집 주소';
  untrusted.conditions.schedule.members[0].availableSlots[0].departureAddress='비공개 출발지';
  untrusted.conditions.schedule.secretOrigin='비공개 위치';
  untrusted.candidates[0].station='비공개 역';
  const p=await call(owner,'c_schedule_create',[team,untrusted,[]]);
  assert.equal(JSON.stringify(p).includes('비공개'),false);
  const offline=await call(owner,'c_schedule_action',[p.id,'mode',{mode:'offline'},p.version]);
  const place={timeOptionId:id,status:'ok',places:[{id:'place-a',name:'장소',url:null,rank:1,homeAddress:'비공개 집 주소',travel:[{memberId:owner,minutes:25,status:'ok',originAddress:'비공개 출발지'}]}],providerSecret:'비공개 위치'};
  const saved=await call(owner,'c_schedule_action',[p.id,'places',{results:[place]},offline.version]);
  assert.equal(JSON.stringify(saved).includes('비공개'),false);
  const custom=await call(member,'c_schedule_action',[p.id,'respond',{kind:'custom',selectedCandidateIds:[],customSlots:[{startAt:start,endAt:end,originAddress:'비공개 출발지'}],extraCandidates:[]},saved.version]);
  assert.equal(JSON.stringify(custom).includes('비공개'),false);
  const conditioned=await call(member,'c_schedule_action',[p.id,'condition',{kind:'preferred',slot:{startAt:start,endAt:end,originAddress:'비공개 출발지'}},custom.version]);
  assert.equal(JSON.stringify(conditioned).includes('비공개'),false);
  assert.equal(JSON.stringify((await call(owner,'c_schedule_get',[p.id])).placeResults).includes('비공개'),false);
 }finally{await db.close()}
});

test('DB: missing team ID, meeting mode and response status are rejected',async()=>{
 const {db,call,state}=await dbFixture();try{
  const noTeam=structuredClone(state) as any;
  delete noTeam.conditions.schedule.teamId;
  await assert.rejects(call(owner,'c_schedule_create',[team,noTeam,[]]),/C_MEMBER_MISMATCH/);
  const noMode=structuredClone(state) as any;
  delete noMode.conditions.meetingMode;
  await assert.rejects(call(owner,'c_schedule_create',[team,noMode,[]]),/C_INVALID_INPUT/);
  const noStatus=structuredClone(state) as any;
  delete noStatus.conditions.schedule.members[0].responseStatus;
  await assert.rejects(call(owner,'c_schedule_create',[team,noStatus,[]]),/C_INVALID_INPUT/);
 }finally{await db.close()}
});

test('DB: B placeType is stored for offline meetings and rejected for online meetings',async()=>{
 const {db,call,state}=await dbFixture();try{
  await db.exec(readFileSync('supabase/c-place-type-migration.sql','utf8'));
  const offline=structuredClone(state) as any;
  offline.mode='offline';offline.conditions.meetingMode='offline';offline.conditions.placeType='합주실';
  const saved=await call(owner,'c_schedule_create',[team,offline,[]]);
  assert.equal(saved.conditions.placeType,'합주실');
  const online=structuredClone(state) as any;
  online.conditions.placeType='합주실';
  await assert.rejects(call(owner,'c_schedule_create',[team,online,[]]),/C_INVALID_INPUT/);
  offline.conditions.placeType={secretOrigin:'비공개 위치'};
  await assert.rejects(call(owner,'c_schedule_create',[team,offline,[]]),/C_INVALID_INPUT/);
 }finally{await db.close()}
});
