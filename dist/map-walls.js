const EPS=1;
function remaining(length,holes){
  const merged=[];
  for(const [a,b] of holes.map(([a,b])=>[Math.max(0,a),Math.min(length,b)]).filter(([a,b])=>b-a>EPS).sort((a,b)=>a[0]-b[0])){
    const last=merged.at(-1);if(last&&a<=last[1]+EPS)last[1]=Math.max(last[1],b);else merged.push([a,b]);
  }
  const result=[];let start=0;for(const [a,b] of merged){if(a>start)result.push([start,a]);start=b;}if(start<length)result.push([start,length]);return result;
}
// Cut only the actual overlap with an adjoining open passage; unrelated walls stay intact.
export function wallSegments(room,rooms){
  const holes={n:[],e:[],s:[],w:[]},right=room.x+room.width,bottom=room.y+room.height;
  for(const corridor of rooms.filter(r=>r.open&&r.id!==room.id)){
    const cr=corridor.x+corridor.width,cb=corridor.y+corridor.height;
    if(corridor.y<room.y-EPS&&cb>=room.y-EPS)holes.n.push([corridor.x-room.x,cr-room.x]);
    if(cb>bottom+EPS&&corridor.y<=bottom+EPS)holes.s.push([corridor.x-room.x,cr-room.x]);
    if(corridor.x<room.x-EPS&&cr>=room.x-EPS)holes.w.push([corridor.y-room.y,cb-room.y]);
    if(cr>right+EPS&&corridor.x<=right+EPS)holes.e.push([corridor.y-room.y,cb-room.y]);
  }
  return{n:remaining(room.width,holes.n),s:remaining(room.width,holes.s),e:remaining(room.height,holes.e),w:remaining(room.height,holes.w)};
}
export function wallPath(room,rooms){
  if(room.open)return'';
  return Object.entries(wallSegments(room,rooms)).flatMap(([side,segments])=>segments.map(([a,b])=>side==='n'?`M${a} 0H${b}`:side==='s'?`M${a} ${room.height}H${b}`:side==='w'?`M0 ${a}V${b}`:`M${room.width} ${a}V${b}`)).join('');
}
