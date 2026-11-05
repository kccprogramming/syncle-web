import {updateProposal} from '@/server/scheduling/http';
export async function POST(req:Request,ctx:{params:Promise<{proposalId:string}>}){return updateProposal(req,(await ctx.params).proposalId,'mode')}
