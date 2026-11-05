-- Apply once after C SQL commit 55ec72e; preserves existing proposals.
-- Adds B placeType and daily meetingHours to the C conditions allowlist.
begin;
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
 if s ? 'meetingHours' and (
  jsonb_typeof(s->'meetingHours') is distinct from 'object'
  or (s#>>'{meetingHours,start}' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') is distinct from true
  or (s#>>'{meetingHours,end}' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') is distinct from true
  or s#>>'{meetingHours,start}' >= s#>>'{meetingHours,end}'
 ) then raise exception 'C_INVALID_INPUT'; end if;
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
   'meetingHours',jsonb_build_object('start',coalesce(s#>'{meetingHours,start}','"09:00"'::jsonb),'end',coalesce(s#>'{meetingHours,end}','"22:00"'::jsonb)),
   'durationMinutes',scheduling.safe_scalar(s->'durationMinutes'),
   'requiredMemberIds',scheduling.safe_text_array(s->'requiredMemberIds'),
   'stepMinutes',30,'maxCandidates',3,'members',members));
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
 and (a at time zone 'Asia/Seoul')::date = (b at time zone 'Asia/Seoul')::date
 and (a at time zone 'Asia/Seoul')::time >= coalesce(s#>>'{conditions,schedule,meetingHours,start}','09:00')::time
 and (b at time zone 'Asia/Seoul')::time <= coalesce(s#>>'{conditions,schedule,meetingHours,end}','22:00')::time
 and c->>'id' = 'time:' || (c->>'startAt') || '/' || (c->>'endAt'), false);
exception when others then return false;
end $$;
commit;
