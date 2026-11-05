import {getProposal} from '@/server/scheduling/http';
export async function GET(req:Request,ctx:{params:Promise<{proposalId:string}>}){return getProposal(req,(await ctx.params).proposalId)}
