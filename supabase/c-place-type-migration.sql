-- Apply once after C SQL commit 55ec72e; preserves existing proposals.
-- Adds B placeType to the C conditions allowlist.
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
commit;
