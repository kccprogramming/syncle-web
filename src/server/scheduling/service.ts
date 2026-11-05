import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Conditions, ExtractionInput, Slot } from '@/server/b/b-c-contract';
import { calculateTimeCandidates, meetingHours, withinMeetingHours } from '@/features/scheduling/calculate-time-candidates';
import type { ScheduleInput } from '@/features/scheduling/types';
import { ScheduleError, assertDeadlines, projectProposal, type StoredProposal, type PlaceResult } from '@/features/scheduling/proposals';
import { handleAiRequest, buildConfirmationCards } from '@/server/b/mvp';
import { AI_BUSY_MESSAGE, geminiGenerate, isAiBusy } from '@/server/gemini-generate';
import { findPlaces } from '@/server/d/findPlaces';
import { combineRegionPlaces } from '@/features/scheduling/region-places';
import { loadPrivateTeamOriginsForCalculation, TeamOriginLoadError } from '@/server/a/private-team-origins';

export async function authenticated(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new ScheduleError('LOGIN_REQUIRED', '로그인이 필요해요.', 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ScheduleError('NOT_CONFIGURED', 'Supabase 연결 설정이 필요해요.', 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ScheduleError('LOGIN_REQUIRED', '로그인을 다시 확인해 주세요.', 401);
  return { db, user: data.user };
}
export async function rpc<T>(db: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    const code = error.message.match(/C_[A-Z_]+/)?.[0];
    const messages: Record<string,string> = {
      C_FORBIDDEN:'이 팀의 구성원만 사용할 수 있어요.', C_OWNER_REQUIRED:'방장만 변경·확정할 수 있어요.', C_NOT_FOUND:'회의 제안을 찾지 못했어요.',
      C_STALE_VERSION:'다른 사람이 먼저 변경했어요. 새로 불러온 뒤 다시 시도해 주세요.', C_RESPONSE_CLOSED:'응답 마감이 지났어요.', C_ALREADY_CONFIRMED:'이미 확정된 회의예요.',
      C_PARTIAL_CONFIRMATION_REQUIRED:'전원 참석이 확인되지 않았어요. 참석 인원을 확인한 뒤 확정해 주세요.', C_NO_CONFIRMED_ATTENDEES:'이 시간에 가능하다고 응답한 사람이 없어요.',
      C_REMINDER_THROTTLED:'다시 알림은 1분 후에 보낼 수 있어요.', C_PLACE_REQUIRED:'이 시간의 장소를 먼저 선택해 주세요.',
    };
    if (code) throw new ScheduleError(code,messages[code] ?? '입력과 현재 회의 상태를 확인해 주세요.',code==='C_NOT_FOUND'?404:code==='C_FORBIDDEN'||code==='C_OWNER_REQUIRED'?403:409);
    throw new ScheduleError('STORAGE_NOT_READY','일정 저장소 연결을 확인해 주세요. C SQL 적용 여부를 담당자와 확인해 주세요.',503);
  }
  return data as T;
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length>1000000) throw new ScheduleError('INVALID_INPUT','요청 내용이 너무 커요.');
  let value: unknown; try { value=JSON.parse(text); } catch { throw new ScheduleError('INVALID_INPUT','JSON 입력을 확인해 주세요.'); }
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new ScheduleError('INVALID_INPUT','입력 형식을 확인해 주세요.');
  return value as Record<string,unknown>;
}
export function errorResponse(error: unknown) {
  if (error instanceof ScheduleError) return Response.json({ok:false,error:{code:error.code,message:error.message}},{status:error.status});
  // Gemini 사용량 한도(429)는 알기 쉬운 안내로 (발표 시연 중 여러 명이 연달아 부르면 생겨요)
  if (isAiBusy(error)) return Response.json({ok:false,error:{code:'AI_BUSY',message:AI_BUSY_MESSAGE}},{status:503});
  if (error && typeof error==='object' && 'status' in error && [429,503].includes(Number(error.status))) {
    return Response.json({ok:false,error:{code:'AI_UNAVAILABLE',message:'AI 요청이 제한되었거나 일시적으로 사용할 수 없어요. 잠시 후 다시 시도해 주세요.'}},{status:503});
  }
  // Never return provider exceptions, URLs containing credentials, or raw extracted JSON.
  // 화면에는 숨기고 서버 기록에만 원인 첫 줄을 남겨요 (예: 'Invalid extraction: availableSlots.endAt', 모델 404)
  console.error('[scheduling] request failed:', error instanceof Error ? error.message.split('\n')[0].slice(0,200) : String(error).slice(0,200));
  return Response.json({ok:false,error:{code:'INVALID_INPUT',message:'입력 형식과 회의 조건을 확인해 주세요.'}},{status:400});
}
export function ok(data: unknown) { return Response.json({ok:true,data}); }
const text = (v:unknown) => typeof v==='string' ? v : '';
function safeConditions(value: Conditions): Conditions {
  const s=value.schedule;
  return { purpose:value.purpose,meetingMode:value.meetingMode,agenda:value.agenda,sourceMessageIds:value.sourceMessageIds,origins:[],placeRequirements:value.placeRequirements,placeType:value.meetingMode==='offline'&&typeof value.placeType==='string'?value.placeType.trim().slice(0,100)||null:null,
    schedule:{teamId:s.teamId,timezone:s.timezone,searchWindow:s.searchWindow,meetingHours:meetingHours(s as ScheduleInput),durationMinutes:s.durationMinutes,requiredMemberIds:s.requiredMemberIds,stepMinutes:30,maxCandidates:3,
      members:s.members.map(m=>({memberId:m.memberId,responseStatus:m.responseStatus,availableSlots:m.availableSlots,unavailableSlots:m.unavailableSlots,...(m.preferredSlots?{preferredSlots:m.preferredSlots}:{})}))} as ScheduleInput };
}
export async function teamInput(db:SupabaseClient,userId:string,teamId:string,body:Record<string,unknown>):Promise<ExtractionInput> {
  const membership=await db.from('team_members').select('member_id').eq('team_id',teamId).eq('member_id',userId).maybeSingle();
  if (membership.error || !membership.data) throw new ScheduleError('FORBIDDEN','팀 구성원만 사용할 수 있어요.',403);
  const [team,members,messages]=await Promise.all([
    db.from('teams').select('id,ai_enabled,ai_read_scope').eq('id',teamId).single(),
    db.from('team_members').select('member_id').eq('team_id',teamId),
    db.from('messages').select('id,sender_id,content,created_at').eq('team_id',teamId).eq('message_type','general').is('visible_to',null).order('created_at',{ascending:false}).limit(100),
  ]);
  if (team.error||members.error||messages.error) throw new ScheduleError('TEAM_CONTEXT_FAILED','팀 정보와 대화를 읽지 못했어요.',503);
  if (!team.data.ai_enabled) throw new ScheduleError('AI_DISABLED','이 팀의 AI 도우미가 꺼져 있어요.',409);
  const ids=members.data.map(m=>String(m.member_id));
  const profiles=await db.from('profiles').select('id,nickname').in('id',ids);
  if (profiles.error) throw new ScheduleError('TEAM_CONTEXT_FAILED','팀원 정보를 읽지 못했어요.',503);
  const window=body.searchWindow as Slot;
  const referenceDate=text(body.referenceDate);
  const all=messages.data.filter(m=>m.sender_id&&ids.includes(String(m.sender_id))).reverse();
  const source=team.data.ai_read_scope==='mentioned_only'?all.filter(m=>/(?:^|\s)@AI(?:\s|$)/i.test(m.content)):all;
  return {teamId,timezone:'Asia/Seoul',referenceDate,searchWindow:window,requiredMemberIds:ids,
    members:ids.map(id=>({memberId:id,name:profiles.data.find(p=>p.id===id)?.nickname??'팀원',station:null})),
    messages:source.map(m=>({id:String(m.id),senderId:String(m.sender_id),text:String(m.content),sentAt:String(m.created_at)}))};
}
export async function createSchedule(db:SupabaseClient,userId:string,teamId:string,body:Record<string,unknown>) {
  const responseDeadline=text(body.responseDeadline),materialDeadline=text(body.materialDeadline);
  assertDeadlines(responseDeadline,materialDeadline);
  const input=await teamInput(db,userId,teamId,body);
  if (process.env.SCHEDULE_LIVE_AI_ENABLED!=='true') throw new ScheduleError('LIVE_AI_DISABLED','실제 AI 호출이 비활성화되어 있어요. 테스트·시연 승인 후 서버 설정을 확인해 주세요.',503);
  const extraction=await handleAiRequest(text(body.text),input,geminiGenerate);
  if (extraction.status==='ignored'||extraction.status==='not_supported'||extraction.status==='clarify_request'||extraction.status==='card') return extraction;
  const conditions=extraction.status==='ready'?extraction.conditions:extraction.draft;
  if (!conditions) return extraction;
  // 지우님 9834b43: 매일 회의 가능 시간 (화면이 보내요, 없으면 09:00~22:00)
  if (body.meetingHours !== undefined) {
    if (!body.meetingHours || typeof body.meetingHours !== 'object' || Array.isArray(body.meetingHours))
      throw new ScheduleError('INVALID_MEETING_HOURS','회의 가능 시간의 시작과 종료를 확인해 주세요.');
    const requested = body.meetingHours as Record<string,unknown>;
    if (typeof requested.start !== 'string' || typeof requested.end !== 'string')
      throw new ScheduleError('INVALID_MEETING_HOURS','회의 가능 시간은 HH:mm 형식으로 입력해 주세요.');
    (conditions.schedule as ScheduleInput).meetingHours = { start: requested.start, end: requested.end };
  }
  try { meetingHours(conditions.schedule as ScheduleInput); }
  catch { throw new ScheduleError('INVALID_MEETING_HOURS','회의 가능 시간은 09:00~22:00처럼 입력해 주세요.'); }
  if (conditions.schedule.durationMinutes>720) throw new ScheduleError('INVALID_INPUT','회의 길이는 12시간 이내로 설정해 주세요.');
  const safe=safeConditions(conditions);
  const candidates=calculateTimeCandidates(safe.schedule).candidates;
  const registry=customCandidates({conditions:safe} as StoredProposal,[safe.schedule.searchWindow]);
  const cards=buildConfirmationCards(extraction,{proposalId:'pending',teamId,candidates:candidates.map(c=>({candidateId:c.id,startAt:c.startAt,endAt:c.endAt}))});
  const stored=await rpc<StoredProposal>(db,'c_schedule_create',{p_team_id:teamId,p_state:{title:safe.purpose,mode:safe.meetingMode,conditions:safe,candidates:registry,responseDeadline,materialDeadline},p_cards:cards});
  return {status:extraction.status,proposal:projectProposal(stored)};
}
export function customCandidates(proposal:StoredProposal,slots:Slot[]) {
  const s=proposal.conditions.schedule, duration=s.durationMinutes*60000, windowStart=Date.parse(s.searchWindow.startAt),windowEnd=Date.parse(s.searchWindow.endAt),hours=meetingHours(s as ScheduleInput);
  const kst=(n:number)=>new Date(n+9*3600000).toISOString().slice(0,19)+'+09:00';
  const extra:{id:string;startAt:string;endAt:string}[]=[];
  for(let t=windowStart;t+duration<=windowEnd;t+=30*60000){
    if(withinMeetingHours(t,t+duration,hours)&&slots.some(slot=>Date.parse(slot.startAt)<=t&&Date.parse(slot.endAt)>=t+duration)){
      const startAt=kst(t),endAt=kst(t+duration);extra.push({id:`time:${startAt}/${endAt}`,startAt,endAt});
    }
  }
  return extra;
}
export async function respond(db:SupabaseClient,proposal:StoredProposal,body:Record<string,unknown>) {
  const kind=body.kind,ids=body.selectedCandidateIds,slots=body.customSlots;
  if (!['selected','declined_all','custom'].includes(String(kind))||!Array.isArray(ids)||!Array.isArray(slots)) throw new ScheduleError('INVALID_RESPONSE','응답 형식을 확인해 주세요.');
  const customSlots=slots as Slot[];
  if(kind==='custom') {
    if(!slots.length||slots.length>10)throw new ScheduleError('INVALID_RESPONSE','다른 시간은 1~10개 입력해 주세요.');
    // Reuse the same strict slot validation as B and C.
    const {validateMeetingSlot}=await import('@/server/b/extractor');
    for(const slot of customSlots){
      validateMeetingSlot(slot,proposal.conditions.schedule.searchWindow);
      if(!withinMeetingHours(Date.parse(slot.startAt),Date.parse(slot.endAt),meetingHours(proposal.conditions.schedule as ScheduleInput)))
        throw new ScheduleError('INVALID_MEETING_HOURS','직접 입력한 시간도 회의 가능 시간 안에서 골라 주세요.');
    }
  }
  return rpc<StoredProposal>(db,'c_schedule_action',{p_id:proposal.id,p_action:'respond',p_version:body.version,
    p_payload:{kind,selectedCandidateIds:ids,customSlots,extraCandidates:[]}});
}
export async function retryPlaces(db:SupabaseClient,proposal:StoredProposal,body:Record<string,unknown>,request:Request,userId:string) {
  if(proposal.mode==='online')return proposal;
  if(userId!==proposal.ownerId)throw new ScheduleError('OWNER_REQUIRED','방장만 장소를 다시 찾을 수 있어요.',403);
  if(process.env.SCHEDULE_LIVE_PLACES_ENABLED!=='true')throw new ScheduleError('LIVE_PLACES_DISABLED','실제 장소 조회가 비활성화되어 있어요. 테스트·시연 승인 후 설정을 확인해 주세요.',503);
  const timeOptionId=text(body.timeOptionId);
  const candidate=projectProposal(proposal).candidates.find(item=>item.id===timeOptionId);
  if(!candidate)throw new ScheduleError('INVALID_CANDIDATE','먼저 장소를 찾을 시간 후보를 선택해 주세요.');
  const requested=Array.isArray(body.searchAreas)?body.searchAreas:[body.searchArea];
  if(requested.length<1||requested.length>3||requested.some(area=>typeof area!=='string'||!area.trim()||area.trim().length>80))
    throw new ScheduleError('SEARCH_AREA_REQUIRED','검색 지역을 1~3개 입력해 주세요.');
  const areas=[...new Set(requested.map(area=>(area as string).trim()))];
  if(areas.length!==requested.length)throw new ScheduleError('INVALID_INPUT','검색 지역은 중복 없이 입력해 주세요.');
  const travelLimitMinutes=60;
  if(body.maxTravelMinutes!==undefined&&body.maxTravelMinutes!==travelLimitMinutes)
    throw new ScheduleError('INVALID_TRAVEL_LIMIT','팀에서 정한 최대 이동시간은 60분이에요.');
  let privateOrigins;
  try { privateOrigins=await loadPrivateTeamOriginsForCalculation(request,proposal.teamId); }
  catch(error){if(error instanceof TeamOriginLoadError)throw new ScheduleError(error.code,error.message,error.status);throw error;}
  const origins=new Map(privateOrigins.map(item=>[item.memberId,item.origin]));
  const members=proposal.memberIds.map(memberId=>({memberId,...(origins.get(memberId)?{origin:origins.get(memberId)!}:{})}));
  const searches=[];
  for(const area of areas){
    try {
      const result=await findPlaces({teamId:proposal.teamId,proposalId:proposal.id,timeOptionId,meetingMode:'offline',meetingPurpose:text(body.keyword).trim().slice(0,100)||text(proposal.conditions.placeType).trim().slice(0,100)||'회의 공간',searchArea:area,expectedAttendeeCount:Math.max(1,candidate.availableCount),startAt:candidate.startAt,endAt:candidate.endAt,dataMode:'api',requiredConditions:proposal.conditions.placeRequirements,members},{previewUnverified:true});
      searches.push({area,status:result.status==='ok'?'ok' as const:'error' as const,places:result.status==='ok'?result.places:[]});
    } catch { searches.push({area,status:'error' as const,places:[]}); }
  }
  const combined:PlaceResult=combineRegionPlaces(timeOptionId,searches,proposal.memberIds,travelLimitMinutes);
  return rpc<StoredProposal>(db,'c_schedule_action',{p_id:proposal.id,p_action:'places',p_version:body.version,p_payload:{results:[combined],progress:{step:combined.status==='error'?'partial-fail':'done'}}});
}
