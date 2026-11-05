-- 방장이 팀원 내보내기 (11/6 밤 희원 요청 · A 현서님 검토 부탁)
-- Supabase → SQL Editor에서 한 번 실행해요. 함수만 만들어서 다시 실행해도 안전해요.
-- 규칙: 방장만, 나 자신은 못 내보냄(나가기 · 방장 넘기기를 써요), 이 팀의 팀원만.
-- leave_team과 같이 team_members 한 줄만 지워요 (그 사람이 쓴 대화 · 자료 · 할 일은 남아요).
begin;
create or replace function public.remove_team_member(p_team_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  if not public.is_team_owner(p_team_id) then raise exception 'OWNER_REQUIRED'; end if;
  if p_member_id = auth.uid() then raise exception 'CANNOT_REMOVE_SELF'; end if;
  if not public.is_team_member_user(p_team_id, p_member_id) then raise exception 'NOT_A_TEAM_MEMBER'; end if;
  delete from public.team_members where team_id = p_team_id and member_id = p_member_id;
end;
$$;
revoke all on function public.remove_team_member(uuid, uuid) from public, anon;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
commit;
