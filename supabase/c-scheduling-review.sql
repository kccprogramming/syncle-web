-- REVIEW ONLY. Apply after A's base schema and migrations 002/003/004/005.
-- Isolated schema preserves any older public proposals/votes draft.
begin;
create schema if not exists scheduling;
create table if not exists scheduling.proposals (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 state jsonb not null, version integer not null default 0,
 created_by uuid not null references auth.users(id),
 last_reminded_at timestamptz
);
create table if not exists scheduling.responses (
 proposal_id uuid not null references scheduling.proposals(id) on delete cascade,
 member_id uuid not null references auth.users(id), payload jsonb not null,
 updated_at timestamptz not null default now(), primary key(proposal_id,member_id)
);
alter table scheduling.proposals enable row level security;
alter table scheduling.responses enable row level security;
revoke all on schema scheduling from public, anon, authenticated;
revoke all on all tables in schema scheduling from public, anon, authenticated;

-- Project untrusted JSON onto the storage contract. Unknown keys (including
-- alternate names for private origins) cannot enter proposal state.
create or replace function scheduling.safe_text_array(items jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb; result jsonb := '[]'::jsonb;
begin
 if jsonb_typeof(items) is distinct from 'array' then raise exception 'C_INVALID_INPUT'; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item) is distinct from 'string' then raise exception 'C_INVALID_INPUT'; end if;
  result := result || jsonb_build_array(item);
 end loop;
 return result;
end $$;

create or replace function scheduling.safe_slots(items jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb; result jsonb := '[]'::jsonb;
begin
 if jsonb_typeof(items) is distinct from 'array' then raise exception 'C_INVALID_INPUT'; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'startAt') is distinct from 'string'
   or jsonb_typeof(item->'endAt') is distinct from 'string' then raise exception 'C_INVALID_INPUT'; end if;
  result := result || jsonb_build_array(jsonb_build_object('startAt',item->'startAt','endAt',item->'endAt'));
 end loop;
 return result;
end $$;

create or replace function scheduling.safe_scalar(value jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
begin
 if value is not null and jsonb_typeof(value) not in ('string','number','boolean','null') then raise exception 'C_INVALID_INPUT'; end if;
 return coalesce(value,'null'::jsonb);
end $$;

create or replace function scheduling.safe_conditions(c jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare s jsonb; member jsonb; members jsonb := '[]'::jsonb;
begin
 if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'purpose') is distinct from 'string'
  or (c->>'meetingMode' is distinct from 'online' and c->>'meetingMode' is distinct from 'offline')
  or (c ? 'placeType' and jsonb_typeof(c->'placeType') not in ('null','string'))
  or (c->>'meetingMode'='online' and c ? 'placeType' and c->'placeType'<>'null'::jsonb)
  or length(c->>'placeType')>100
  or jsonb_typeof(c->'schedule') is distinct from 'object'
  or jsonb_typeof(c#>'{schedule,members}') is distinct from 'array' then raise exception 'C_INVALID_INPUT'; end if;
 s := c->'schedule';
 for member in select value from jsonb_array_elements(s->'members') loop
  if jsonb_typeof(member) is distinct from 'object' or jsonb_typeof(member->'memberId') is distinct from 'string'
   or (member->>'responseStatus' is distinct from 'provided' and member->>'responseStatus' is distinct from 'missing'
    and member->>'responseStatus' is distinct from 'needs_confirmation') then raise exception 'C_INVALID_INPUT'; end if;
  members := members || jsonb_build_array(jsonb_build_object(
   'memberId',member->'memberId','responseStatus',member->'responseStatus',
   'availableSlots',scheduling.safe_slots(member->'availableSlots'),
   'unavailableSlots',scheduling.safe_slots(member->'unavailableSlots'),
   'preferredSlots',scheduling.safe_slots(coalesce(member->'preferredSlots','[]'::jsonb))));
 end loop;
 return jsonb_build_object(
  'purpose',c->'purpose','meetingMode',c->'meetingMode',
  'placeType',case when jsonb_typeof(c->'placeType')='string' then c->'placeType' else 'null'::jsonb end,
  'agenda',scheduling.safe_text_array(c->'agenda'),
  'sourceMessageIds',scheduling.safe_text_array(c->'sourceMessageIds'),
  'placeRequirements',scheduling.safe_text_array(c->'placeRequirements'),
  'origins','[]'::jsonb,
  'schedule',jsonb_build_object(
   'teamId',scheduling.safe_scalar(s->'teamId'),'timezone',scheduling.safe_scalar(s->'timezone'),
   'searchWindow',jsonb_build_object('startAt',scheduling.safe_scalar(s#>'{searchWindow,startAt}'),'endAt',scheduling.safe_scalar(s#>'{searchWindow,endAt}')),
   'durationMinutes',scheduling.safe_scalar(s->'durationMinutes'),
   'requiredMemberIds',scheduling.safe_text_array(s->'requiredMemberIds'),
   'stepMinutes',30,'maxCandidates',3,'members',members));
end $$;

create or replace function scheduling.safe_place_result(result jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare place jsonb; trip jsonb; places jsonb := '[]'::jsonb; travel jsonb;
begin
 if jsonb_typeof(result) is distinct from 'object' or jsonb_typeof(result->'places') is distinct from 'array' then raise exception 'C_INVALID_INPUT'; end if;
 for place in select value from jsonb_array_elements(result->'places') loop
  if jsonb_typeof(place) is distinct from 'object' then raise exception 'C_INVALID_INPUT'; end if;
  travel := '[]'::jsonb;
  if jsonb_typeof(coalesce(place->'travel','[]'::jsonb)) is distinct from 'array' then raise exception 'C_INVALID_INPUT'; end if;
  for trip in select value from jsonb_array_elements(coalesce(place->'travel','[]'::jsonb)) loop
   travel := travel || jsonb_build_array(jsonb_build_object('memberId',scheduling.safe_scalar(trip->'memberId'),'minutes',scheduling.safe_scalar(trip->'minutes'),'status',scheduling.safe_scalar(trip->'status')));
  end loop;
  places := places || jsonb_build_array(jsonb_build_object(
   'id',scheduling.safe_scalar(place->'id'),'name',scheduling.safe_scalar(place->'name'),'area',scheduling.safe_scalar(place->'area'),'url',scheduling.safe_scalar(place->'url'),
   'rank',scheduling.safe_scalar(place->'rank'),'maxTravelMinutes',scheduling.safe_scalar(place->'maxTravelMinutes'),
   'travelTimeDifference',scheduling.safe_scalar(place->'travelTimeDifference'),'travel',travel,'reason',scheduling.safe_scalar(place->'reason')));
 end loop;
 return jsonb_build_object('timeOptionId',scheduling.safe_scalar(result->'timeOptionId'),'status',scheduling.safe_scalar(result->'status'),
  'searchAreas',scheduling.safe_text_array(coalesce(result->'searchAreas','[]'::jsonb)),
  'travelLimitMinutes',scheduling.safe_scalar(result->'travelLimitMinutes'),'places',places,
  'error',case when jsonb_typeof(result->'error')='object' then jsonb_build_object('code',scheduling.safe_scalar(result#>'{error,code}'),'message',scheduling.safe_scalar(result#>'{error,message}')) else null end,
  'checkedAt',scheduling.safe_scalar(result->'checkedAt'));
end $$;

create or replace function scheduling.check_candidate(s jsonb, c jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare a timestamptz; b timestamptz;
begin
 if jsonb_typeof(c) <> 'object' or coalesce(c->>'id','') = '' then return false; end if;
 if not (c->>'startAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$') or not (c->>'endAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$') then return false; end if;
 a := (c->>'startAt')::timestamptz; b := (c->>'endAt')::timestamptz;
 return coalesce(b > a and extract(epoch from (b-a)) = (s#>>'{conditions,schedule,durationMinutes}')::integer * 60
 and a >= (s#>>'{conditions,schedule,searchWindow,startAt}')::timestamptz
 and b <= (s#>>'{conditions,schedule,searchWindow,endAt}')::timestamptz
 and c->>'id' = 'time:' || (c->>'startAt') || '/' || (c->>'endAt'), false);
exception when others then return false;
end $$;

create or replace function public.c_schedule_get(p_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, scheduling as $$
declare p scheduling.proposals; owner_id uuid; rows jsonb;
begin
 select * into p from scheduling.proposals where id=p_id;
 if p.id is null then raise exception 'C_NOT_FOUND'; end if;
 if auth.uid() is null or not public.is_team_member(p.team_id) then raise exception 'C_FORBIDDEN'; end if;
 select member_id into owner_id from public.team_members where team_id=p.team_id and member_role='owner' limit 1;
 select coalesce(jsonb_agg(r.payload || jsonb_build_object('memberId',r.member_id)), '[]') into rows from scheduling.responses r where r.proposal_id=p.id;
 return p.state || jsonb_build_object('id',p.id,'teamId',p.team_id,'ownerId',owner_id,'version',p.version,'responses',rows);
end $$;

create or replace function public.c_schedule_create(p_team_id uuid, p_state jsonb, p_cards jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, scheduling as $$
declare new_id uuid; team_ids jsonb; input_ids jsonb; c jsonb; card jsonb; v_state jsonb; safe_candidates jsonb := '[]'::jsonb;
begin
 if auth.uid() is null or not public.is_team_member(p_team_id) then raise exception 'C_FORBIDDEN'; end if;
 if jsonb_typeof(p_state) is distinct from 'object' or octet_length(p_state::text)>1000000 then raise exception 'C_INVALID_INPUT'; end if;
 select jsonb_agg(member_id::text order by member_id::text) into team_ids from public.team_members where team_id=p_team_id;
 select jsonb_agg(m->>'memberId' order by m->>'memberId') into input_ids from jsonb_array_elements(p_state#>'{conditions,schedule,members}') m;
 if input_ids is distinct from team_ids or p_state#>>'{conditions,schedule,teamId}' is distinct from p_team_id::text then raise exception 'C_MEMBER_MISMATCH'; end if;
 if coalesce(length(trim(p_state->>'title')),0)=0 or length(p_state->>'title')>300
 or coalesce(p_state->>'mode','') not in ('online','offline') or coalesce((p_state#>>'{conditions,schedule,durationMinutes}')::integer,0) not between 1 and 720
 or (p_state->>'responseDeadline')::timestamptz <= clock_timestamp()
 or (p_state->>'responseDeadline')::timestamptz >= (p_state->>'materialDeadline')::timestamptz
 or (p_state#>>'{conditions,schedule,searchWindow,endAt}')::timestamptz - (p_state#>>'{conditions,schedule,searchWindow,startAt}')::timestamptz > interval '31 days'
 or jsonb_typeof(p_state->'candidates') is distinct from 'array' or jsonb_array_length(p_state->'candidates')>2000 then raise exception 'C_INVALID_INPUT'; end if;
 if p_state->>'responseDeadline' is null or p_state->>'materialDeadline' is null then raise exception 'C_INVALID_INPUT'; end if;
 for c in select value from jsonb_array_elements(p_state->'candidates') loop
  if not scheduling.check_candidate(p_state,c) then raise exception 'C_INVALID_CANDIDATE'; end if;
  safe_candidates := safe_candidates || jsonb_build_array(jsonb_build_object('id',c->'id','startAt',c->'startAt','endAt',c->'endAt'));
 end loop;
 -- Never store exact origins or arbitrary caller-owned top-level fields.
 v_state := jsonb_build_object('title',p_state->'title','mode',p_state->'mode','conditions',scheduling.safe_conditions(p_state->'conditions'),
 'candidates',safe_candidates,'memberIds',team_ids,'responseDeadline',p_state->'responseDeadline','materialDeadline',p_state->'materialDeadline',
 'meetingUrl',null,'meeting',null,'placeResults','[]'::jsonb,'progress',jsonb_build_object('step',case when p_state->>'mode'='online' then 'done' else 'times' end));
 insert into scheduling.proposals(team_id,state,created_by) values(p_team_id,v_state,auth.uid()) returning id into new_id;
 if jsonb_typeof(p_cards) is distinct from 'array' then raise exception 'C_INVALID_CARD'; end if;
 for card in select value from jsonb_array_elements(p_cards) loop
  if not exists(select 1 from public.team_members where team_id=p_team_id and member_id=(card->>'targetMemberId')::uuid) then raise exception 'C_INVALID_CARD'; end if;
  insert into public.messages(team_id,sender_id,content,message_type,visible_to)
  values(p_team_id,auth.uid(),(card || jsonb_build_object('proposalId',new_id))::text,'confirmation_question',array[(card->>'targetMemberId')::uuid]);
 end loop;
 return public.c_schedule_get(new_id);
end $$;

create or replace function public.c_schedule_action(p_id uuid, p_action text, p_payload jsonb, p_version integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, scheduling as $$
declare p scheduling.proposals; own boolean; kind text; ids jsonb; slots jsonb; c jsonb; s jsonb; t jsonb;
 next_state jsonb; attendee_ids jsonb; target uuid; notified integer := 0; url text; chosen jsonb;
begin
 select * into p from scheduling.proposals where id=p_id for update;
 if p.id is null then raise exception 'C_NOT_FOUND'; end if;
 if auth.uid() is null or not public.is_team_member(p.team_id) or not (p.state->'memberIds' ? auth.uid()::text) then raise exception 'C_FORBIDDEN'; end if;
 if p_version is null or p.version<>p_version then raise exception 'C_STALE_VERSION'; end if;
 if p.state->'meeting' <> 'null'::jsonb then raise exception 'C_ALREADY_CONFIRMED'; end if;
 own:=public.is_team_owner(p.team_id); next_state:=p.state;
 if p_action='respond' then
  if clock_timestamp()>=(p.state->>'responseDeadline')::timestamptz then raise exception 'C_RESPONSE_CLOSED'; end if;
  kind:=p_payload->>'kind'; ids:=p_payload->'selectedCandidateIds'; slots:=p_payload->'customSlots';
  if kind is null or kind not in ('selected','declined_all','custom') or jsonb_typeof(ids) is distinct from 'array' or jsonb_typeof(slots) is distinct from 'array' then raise exception 'C_INVALID_RESPONSE'; end if;
  if kind='selected' then
   if jsonb_array_length(ids)=0 or jsonb_array_length(slots)<>0 or (select count(*) from jsonb_array_elements(ids))<>(select count(distinct value) from jsonb_array_elements(ids))
   or exists(select 1 from jsonb_array_elements_text(ids) i where not exists(select 1 from jsonb_array_elements(p.state->'candidates') opt where opt->>'id'=i)) then raise exception 'C_INVALID_RESPONSE'; end if;
  elsif kind='declined_all' then
   if jsonb_array_length(ids)<>0 or jsonb_array_length(slots)<>0 then raise exception 'C_INVALID_RESPONSE'; end if;
  else
   if jsonb_array_length(ids)<>0 or jsonb_array_length(slots) not between 1 and 10 then raise exception 'C_INVALID_RESPONSE'; end if;
   for s in select value from jsonb_array_elements(slots) loop
    if (s->>'startAt')::timestamptz >= (s->>'endAt')::timestamptz or (s->>'startAt')::timestamptz < (p.state#>>'{conditions,schedule,searchWindow,startAt}')::timestamptz or (s->>'endAt')::timestamptz > (p.state#>>'{conditions,schedule,searchWindow,endAt}')::timestamptz then raise exception 'C_INVALID_RESPONSE'; end if;
   end loop;
   if jsonb_typeof(p_payload->'extraCandidates') is distinct from 'array' or jsonb_array_length(p_payload->'extraCandidates')>2000 then raise exception 'C_INVALID_RESPONSE'; end if;
   for c in select value from jsonb_array_elements(p_payload->'extraCandidates') loop
    if not scheduling.check_candidate(p.state,c) or not exists(select 1 from jsonb_array_elements(slots) x where (x->>'startAt')::timestamptz <= (c->>'startAt')::timestamptz and (x->>'endAt')::timestamptz >= (c->>'endAt')::timestamptz) then raise exception 'C_INVALID_CANDIDATE'; end if;
    if not exists(select 1 from jsonb_array_elements(next_state->'candidates') x where x->>'id'=c->>'id') then next_state:=jsonb_set(next_state,'{candidates}',(next_state->'candidates') || jsonb_build_array(jsonb_build_object('id',c->'id','startAt',c->'startAt','endAt',c->'endAt'))); end if;
   end loop;
  end if;
  slots:=scheduling.safe_slots(slots);
  insert into scheduling.responses(proposal_id,member_id,payload) values(p.id,auth.uid(),jsonb_build_object('kind',kind,'selectedCandidateIds',ids,'customSlots',slots))
  on conflict(proposal_id,member_id) do update set payload=excluded.payload,updated_at=clock_timestamp();
 elsif p_action='condition' then
  if clock_timestamp()>=(p.state->>'responseDeadline')::timestamptz then raise exception 'C_RESPONSE_CLOSED'; end if;
  kind:=p_payload->>'kind'; s:=p_payload->'slot';
  if kind is null or kind not in ('unavailable','preferred') or jsonb_typeof(s) is distinct from 'object' then raise exception 'C_INVALID_INPUT'; end if;
  if not (s->>'startAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$') or not (s->>'endAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$')
  or (s->>'startAt')::timestamptz >= (s->>'endAt')::timestamptz or (s->>'startAt')::timestamptz < (p.state#>>'{conditions,schedule,searchWindow,startAt}')::timestamptz or (s->>'endAt')::timestamptz > (p.state#>>'{conditions,schedule,searchWindow,endAt}')::timestamptz then raise exception 'C_INVALID_INPUT'; end if;
  s:=scheduling.safe_slots(jsonb_build_array(s))->0;
  ids:='[]'::jsonb;
  for t in select value from jsonb_array_elements(p.state#>'{conditions,schedule,members}') loop
   if t->>'memberId'=auth.uid()::text then
    if kind='preferred' then t:=jsonb_set(t,'{preferredSlots}',coalesce(t->'preferredSlots','[]') || jsonb_build_array(s));
    else
     slots:='[]'::jsonb;
     for c in select value from jsonb_array_elements(t->'availableSlots') loop
      if (c->>'endAt')::timestamptz <= (s->>'startAt')::timestamptz or (c->>'startAt')::timestamptz >= (s->>'endAt')::timestamptz then slots:=slots || jsonb_build_array(c);
      else
       if (c->>'startAt')::timestamptz < (s->>'startAt')::timestamptz then slots:=slots || jsonb_build_array(jsonb_build_object('startAt',c->'startAt','endAt',s->'startAt')); end if;
       if (c->>'endAt')::timestamptz > (s->>'endAt')::timestamptz then slots:=slots || jsonb_build_array(jsonb_build_object('startAt',s->'endAt','endAt',c->'endAt')); end if;
      end if;
     end loop;
     t:=t || jsonb_build_object('availableSlots',slots,'unavailableSlots',(t->'unavailableSlots') || jsonb_build_array(s),'responseStatus',case when t->>'responseStatus'='missing' then 'provided' else t->>'responseStatus' end);
    end if;
   end if;
   ids:=ids || jsonb_build_array(t);
  end loop;
  next_state:=jsonb_set(next_state,'{conditions,schedule,members}',ids);
  if kind='unavailable' then delete from scheduling.responses where proposal_id=p.id and member_id=auth.uid(); end if;
  insert into public.messages(team_id,sender_id,content,message_type,visible_to) values(p.team_id,auth.uid(),'@AI 이번 회의 조건: ' || kind || ' ' || (s->>'startAt') || ' ~ ' || (s->>'endAt'),'general',null) returning id into target;
  next_state:=jsonb_set(next_state,'{conditions,sourceMessageIds}',coalesce(next_state#>'{conditions,sourceMessageIds}','[]') || to_jsonb(target::text));
 elsif p_action='mode' then
  if not own then raise exception 'C_OWNER_REQUIRED'; end if;
  if coalesce(p_payload->>'mode','') not in ('online','offline') then raise exception 'C_INVALID_INPUT'; end if;
  url:=nullif(trim(p_payload->>'meetingUrl'),'');
  if url is not null and (url !~ '^https?://' or length(url)>2048) then raise exception 'C_INVALID_URL'; end if;
  next_state:=next_state || jsonb_build_object('mode',p_payload->'mode','meetingUrl',url,'placeResults','[]'::jsonb,'progress',jsonb_build_object('step',case when p_payload->>'mode'='online' then 'done' else 'times' end));
 elsif p_action='places' then
  if not own then raise exception 'C_OWNER_REQUIRED'; end if;
  if next_state->>'mode'<>'offline' then raise exception 'C_ONLINE_SKIPS_PLACES'; end if;
  if jsonb_typeof(p_payload->'results') is distinct from 'array' or jsonb_array_length(p_payload->'results')<>1 then raise exception 'C_INVALID_INPUT'; end if;
  c:=p_payload->'results'->0;
  if coalesce(c->>'status','') not in ('ok','error') or jsonb_typeof(c->'places') is distinct from 'array' or jsonb_array_length(c->'places')>6
   or not exists(select 1 from jsonb_array_elements(p.state->'candidates') opt where opt->>'id'=c->>'timeOptionId') then raise exception 'C_INVALID_INPUT'; end if;
  -- The HTTP layer sanitizes provider output; the DB stores no credentials/origins.
  next_state:=next_state || jsonb_build_object('placeResults',
    (select coalesce(jsonb_agg(prev.value),'[]'::jsonb) from jsonb_array_elements(p.state->'placeResults') prev where prev.value->>'timeOptionId'<>c->>'timeOptionId') || jsonb_build_array(scheduling.safe_place_result(c)),
    'progress',jsonb_build_object('step',case when c->>'status'='error' then 'partial-fail' else 'done' end));
 elsif p_action='remind' then
  if not own then raise exception 'C_OWNER_REQUIRED'; end if;
  if clock_timestamp()>=(p.state->>'responseDeadline')::timestamptz then raise exception 'C_RESPONSE_CLOSED'; end if;
  if p.last_reminded_at > clock_timestamp()-interval '1 minute' then raise exception 'C_REMINDER_THROTTLED'; end if;
  for target in select m.member_id from public.team_members m where m.team_id=p.team_id and p.state->'memberIds' ? m.member_id::text and not exists(select 1 from scheduling.responses r where r.proposal_id=p.id and r.member_id=m.member_id) loop
   if public.create_team_notification(p.team_id,target,'meeting_response','회의 응답을 확인해 주세요',p.state->>'title',p.id::text) is not null then notified:=notified+1; end if;
  end loop;
  update scheduling.proposals set last_reminded_at=clock_timestamp() where id=p.id;
 elsif p_action='confirm' then
  if not own then raise exception 'C_OWNER_REQUIRED'; end if;
  select value into chosen from jsonb_array_elements(p.state->'candidates') where value->>'id'=p_payload->>'candidateId';
  if chosen is null then raise exception 'C_INVALID_CANDIDATE'; end if;
  select coalesce(jsonb_agg(r.member_id),'[]') into attendee_ids from scheduling.responses r where r.proposal_id=p.id and (
   (r.payload->>'kind'='selected' and exists(select 1 from jsonb_array_elements(p.state->'candidates') opt where r.payload->'selectedCandidateIds' ? (opt->>'id') and (opt->>'startAt')::timestamptz <= (chosen->>'startAt')::timestamptz and (opt->>'endAt')::timestamptz >= (chosen->>'endAt')::timestamptz))
   or (r.payload->>'kind'='custom' and exists(select 1 from jsonb_array_elements(r.payload->'customSlots') x where (x->>'startAt')::timestamptz <= (chosen->>'startAt')::timestamptz and (x->>'endAt')::timestamptz >= (chosen->>'endAt')::timestamptz))
  );
  if jsonb_array_length(attendee_ids)=0 then raise exception 'C_NO_CONFIRMED_ATTENDEES'; end if;
  if jsonb_array_length(attendee_ids)<jsonb_array_length(p.state->'memberIds') and coalesce((p_payload->>'allowPartial')::boolean,false)=false then raise exception 'C_PARTIAL_CONFIRMATION_REQUIRED'; end if;
  c:='null'::jsonb;
  if p.state->>'mode'='offline' then
   select x into c from jsonb_array_elements(p.state->'placeResults') g cross join lateral jsonb_array_elements(g->'places') x where g->>'timeOptionId'=chosen->>'id' and x->>'id'=p_payload->>'placeId' and x->>'rank' is not null limit 1;
   if c is null then raise exception 'C_PLACE_REQUIRED'; end if;
   c:=jsonb_build_object('id',c->'id','name',c->'name','url',c->'url');
  end if;
  next_state:=next_state || jsonb_build_object('meeting',jsonb_build_object('id',gen_random_uuid(),'startAt',chosen->'startAt','endAt',chosen->'endAt','attendeeIds',attendee_ids,'mode',p.state->'mode','meetingUrl',p.state->'meetingUrl','place',c),'progress','{"step":"done"}'::jsonb);
  perform public.create_confirmed_message(p.team_id,jsonb_build_object('type','meeting_confirmed','proposalId',p.id,'meeting',next_state->'meeting')::text,null::uuid[]);
 else raise exception 'C_INVALID_ACTION';
 end if;
 update scheduling.proposals set state=next_state,version=version+1 where id=p.id;
 return public.c_schedule_get(p.id) || jsonb_build_object('notifiedCount',notified);
end $$;

create or replace function public.c_schedule_list(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, scheduling as $$
declare results jsonb;
begin
 if auth.uid() is null or not public.is_team_member(p_team_id) then raise exception 'C_FORBIDDEN'; end if;
 select coalesce(jsonb_agg(public.c_schedule_get(p.id)), '[]') into results from (select id from scheduling.proposals where team_id=p_team_id order by id desc limit 50) p;
 return results;
end $$;
revoke all on all functions in schema scheduling from public,anon,authenticated;
revoke all on function public.c_schedule_get(uuid), public.c_schedule_create(uuid,jsonb,jsonb), public.c_schedule_action(uuid,text,jsonb,integer), public.c_schedule_list(uuid) from public,anon;
grant execute on function public.c_schedule_get(uuid), public.c_schedule_create(uuid,jsonb,jsonb), public.c_schedule_action(uuid,text,jsonb,integer), public.c_schedule_list(uuid) to authenticated;
commit;
