import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combineRegionPlaces, type RegionSearch} from '../src/features/scheduling/region-places';

const ids=['u1','u2','u3','u4'];
const place=(placeId:string,times:(number|null)[])=>({placeId,name:placeId,travelTimes:times.map((minutes,i)=>({memberId:ids[i],minutes,status:minutes===null?'unknown':'ok'}))});

test('C compares all regions after the travel limit and never ranks unknown travel',()=>{
 const regions:RegionSearch[]=[
  {area:'서울역',status:'ok',places:[place('서울역 장소',[38,23,20,20]),place('제한 초과',[70,70,70,70])]},
  {area:'시청',status:'ok',places:[place('시청 장소',[32,34,35,33]),place('미확인 장소',[20,21,null,19])]},
  {area:'종로3가',status:'ok',places:[place('종로 장소',[30,32,33,31]),place('서울역 장소',[38,23,20,20])]},
 ];
 const result=combineRegionPlaces('time-1',regions,ids,60,'2030-11-10T00:00:00Z');
 assert.equal(result.places.length,5); // Duplicate place across regions is kept once.
 assert.deepEqual(result.places.filter(p=>p.rank!==null).map(p=>[p.name,p.rank]),[['서울역 장소',3],['시청 장소',2],['종로 장소',1]]);
 assert.equal(result.places.find(p=>p.name==='제한 초과')?.rank,null);
 assert.match(result.places.find(p=>p.name==='미확인 장소')!.reason,/유효한 이동시간/);
 assert.equal(JSON.stringify(result).includes('departure_origin'),false);
});

test('C retains successful regional results when another region fails',()=>{
 const result=combineRegionPlaces('time-2',[
  {area:'시청',status:'error',places:[]}, {area:'종로3가',status:'ok',places:[place('장소',[20,22,21,23])]},
 ],ids,60,'2030-11-10T00:00:00Z');
 assert.equal(result.status,'error');
 assert.equal(result.places[0].rank,1);
 assert.deepEqual(result.searchAreas,['시청','종로3가']);
});

test('C sends travel outcomes without raw departure origins or provider coordinates',()=>{
 const raw=place('장소',[20,22,21,23]) as ReturnType<typeof place> & {departure_origin?:string;address?:string};
 raw.departure_origin='비공개 상세 주소';
 raw.address='장소 주소';
 const result=combineRegionPlaces('time-3',[{area:'시청',status:'ok',places:[raw]}],ids,60);
 const serialized=JSON.stringify(result);
 assert.equal(serialized.includes('비공개 상세 주소'),false);
 assert.equal(serialized.includes('departure_origin'),false);
 assert.deepEqual(result.places[0].travel.map(t=>Object.keys(t).sort()),ids.map(()=>['memberId','minutes','status']));
});
