import {authenticated,errorResponse,jsonBody,ok,rpc,createSchedule,respond,retryPlaces} from './service';
import {projectProposal,type StoredProposal} from '@/features/scheduling/proposals';
export async function getProposal(request:Request,id:string){try{const{db,user}=await authenticated(request);const p=await rpc<StoredProposal>(db,'c_schedule_get',{p_id:id});return ok({...projectProposal(p),viewerId:user.id});}catch(e){return errorResponse(e)}}
export async function updateProposal(request:Request,id:string,action:string){try{
 const{db,user}=await authenticated(request);const body=await jsonBody(request);
 const p=await rpc<StoredProposal>(db,'c_schedule_get',{p_id:id});
 // The 5/6 frontend uses timeCandidateId and acknowledgePartialAttendance.
 const payload=action==='confirm'?{
   ...body,
   candidateId:body.candidateId??body.timeCandidateId,
   allowPartial:body.allowPartial??body.acknowledgePartialAttendance??false,
 }:body;
 const next=action==='respond'?await respond(db,p,body):action==='places'?await retryPlaces(db,p,body,request,user.id):await rpc<StoredProposal>(db,'c_schedule_action',{p_id:id,p_action:action,p_version:body.version,p_payload:payload});
 return ok({...projectProposal(next),viewerId:user.id,...('notifiedCount'in next?{notifiedCount:next.notifiedCount}:{})});
}catch(e){return errorResponse(e)}}
export async function teamSchedule(request:Request,teamId:string){try{const{db,user}=await authenticated(request);if(request.method==='GET'){const rows=await rpc<StoredProposal[]>(db,'c_schedule_list',{p_team_id:teamId});return ok(rows.map(p=>projectProposal(p)))}return ok(await createSchedule(db,user.id,teamId,await jsonBody(request)))}catch(e){return errorResponse(e)}}
