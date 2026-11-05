'use client';
import type {projectProposal} from '@/features/scheduling/proposals';
import {getSupabase} from '@/lib/supabase';
export type LiveProposal = ReturnType<typeof projectProposal> & {viewerId:string;notifiedCount?:number};
/** C 일정 API 호출. 로그인 토큰은 앱의 Supabase 연결(src/lib/supabase.ts)에서 가져와요. */
export async function schedulingRequest<T>(path:string,body?:unknown):Promise<T>{
 const client=getSupabase();
 if(!client)throw new Error('Supabase 연결이 설정되지 않았어요. 통합 담당자에게 확인해 주세요.');
 const {data,error}=await client.auth.getSession();
 if(error||!data.session)throw new Error('로그인이 필요해요. A 담당 로그인 연결을 확인해 주세요.');
 const response=await fetch('/api/scheduling/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.ok)throw new Error(result?.error?.message??'요청을 처리하지 못했어요. 다시 시도해 주세요.');
 return result.data as T;
}
export const isLiveId=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** 실제 제안의 장소 찾기에 넣을 '비교할 지역'(팀원 출발지 가운데 역 3곳)과 '찾을 장소' 추천 — 우리 앱 /api/places/areas */
export type PlaceSearchSuggestion = {areas:string[];keyword:string;keywordLabel:string;keywordReason:string;unknownCount:number};
export async function suggestPlaceSearch(proposalId:string):Promise<PlaceSearchSuggestion>{
 const client=getSupabase();
 const {data}=client?await client.auth.getSession():{data:{session:null}};
 if(!data.session)throw new Error('로그인이 필요해요.');
 const response=await fetch('/api/places/areas',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({proposalId})});
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.ok)throw new Error(result?.error?.message??'지역을 찾지 못했어요.');
 return result.data as PlaceSearchSuggestion;
}

/**
 * 실제 제안 만들기 — C POST /api/scheduling/teams/{teamId}
 * 응답 마감(responseDeadline)과 자료 마감(materialDeadline)은 C가 기본값을 만들지 않아서 화면이 꼭 정해서 보내요.
 * 둘 다 시간대가 붙은 시각("2026-11-08T21:00:00+09:00")이어야 하고, 응답 마감 < 자료 마감, 응답 마감 > 지금.
 * (C 서버도 같은 검사를 해요. 여기서는 보내기 전에 화면에서 바로 알려 주려고 한 번 더 봐요.)
 */
export type CreateLiveProposalInput = {
 /** 대화방에서 보낸 '@AI … 잡아줘' 글 */
 text:string;
 /** 오늘 날짜 (서울) "2026-11-06" — B가 '다음 주 화요일' 같은 말을 날짜로 바꿀 때 기준 */
 referenceDate:string;
 /** 시간을 찾을 범위 */
 searchWindow:{startAt:string;endAt:string};
 responseDeadline:string;
 materialDeadline:string;
 /** 매일 회의 가능 시간 (한국 시간 "HH:mm"). 없으면 C가 09:00~22:00을 써요 (지우님 9834b43) */
 meetingHours?:{start:string;end:string};
};
const withZone=/(?:Z|[+-]\d{2}:\d{2})$/;
export function checkDeadlines(responseDeadline:string,materialDeadline:string,now=Date.now()):string|null{
 if(!withZone.test(responseDeadline)||!withZone.test(materialDeadline))return '마감 시각에 시간대(+09:00)가 필요해요.';
 const r=Date.parse(responseDeadline),m=Date.parse(materialDeadline);
 if(!Number.isFinite(r)||!Number.isFinite(m))return '마감 시각을 확인해 주세요.';
 if(r<=now)return '응답 마감은 지금보다 뒤여야 해요.';
 if(r>=m)return '응답 마감은 자료 마감보다 앞이어야 해요.';
 return null;
}
export async function createLiveProposal<T=unknown>(teamId:string,input:CreateLiveProposalInput):Promise<T>{
 const problem=checkDeadlines(input.responseDeadline,input.materialDeadline);
 if(problem)throw new Error(problem);
 const {text,referenceDate,searchWindow,responseDeadline,materialDeadline,meetingHours}=input;
 return schedulingRequest<T>(`teams/${teamId}`,{text,referenceDate,searchWindow,responseDeadline,materialDeadline,...(meetingHours?{meetingHours}:{})});
}
