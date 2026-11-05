import {teamSchedule} from '@/server/scheduling/http';
type Ctx={params:Promise<{teamId:string}>};
export async function GET(req:Request,ctx:Ctx){return teamSchedule(req,(await ctx.params).teamId)}
export async function POST(req:Request,ctx:Ctx){return teamSchedule(req,(await ctx.params).teamId)}
