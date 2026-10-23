const EPS=1;
function remaining(length,holes){
  const merged=[];
  for(const [a,b] of holes.map(([a,b])=>[Math.max(0,a),Math.min(length,b)]).filter(([a,b])=>b-a>EPS).sort((a,b)=>a[0]-b[0])){
    const last=merged.at(-1);if(last&&a<=last[1]+EPS)last[1]=Math.max(last[1],b);else merged.push([a,b]);
  }
  const result=[];let start=0;for(const [a,b] of merged){if(a>start)result.push([start,a]);start=b;}if(start<length)result.push([start,length]);return result;
}
// A boundary-mounted door aligns its frame with the wall, independently of
// its deep swing footprint. Coordinates here are always in floor space.
export function doorWallPlacement(door,rooms){
  if(door.kind!=='door')return null;
  const parent=rooms.find(r=>r.id===door.roomId),rotation=((door.rotation||0)%360+360)%360;
  const x=door.x+(parent?.x||0),y=door.y+(parent?.y||0),vertical=rotation%180!==0;
  const width=vertical?door.height:door.width,height=vertical?door.width:door.height,candidates=[];
  for(const room of rooms.filter(r=>!r.open)){
    const start=vertical?y:x,end=start+door.width,lower=vertical?room.y:room.x,upper=lower+(vertical?room.height:room.width);
    if(end<=lower+EPS||start>=upper-EPS)continue;
    for(const side of vertical?['w','e']:['n','s']){
      const line=side==='n'?room.y:side==='s'?room.y+room.height:side==='w'?room.x:room.x+room.width;
      const distance=Math.min(Math.abs(line-(vertical?x:y)),Math.abs(line-(vertical?x+width:y+height)));
      if(distance<=12)candidates.push({roomId:room.id,side,line,distance,start:start+door.width*3/80,end:end-door.width*3/80});
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance||Number(b.roomId===door.roomId)-Number(a.roomId===door.roomId));
  const nearest=candidates[0];if(!nearest)return null;
  const original=vertical?x+door.height*(rotation===90?72.5:7.5)/80:y+door.height*(rotation===180?72.5:7.5)/80;
  return{...nearest,axis:vertical?'y':'x',offset:{x:vertical?nearest.line-original:0,y:vertical?0:nearest.line-original}};
}
// Cut only actual passage overlaps and aligned door frames, never entire walls.
export function wallSegments(room,rooms,objects=[]){
  const holes={n:[],e:[],s:[],w:[]},right=room.x+room.width,bottom=room.y+room.height;
  for(const corridor of rooms.filter(r=>r.open&&r.id!==room.id)){
    const cr=corridor.x+corridor.width,cb=corridor.y+corridor.height;
    if(corridor.y<room.y-EPS&&cb>=room.y-EPS)holes.n.push([corridor.x-room.x,cr-room.x]);
    if(cb>bottom+EPS&&corridor.y<=bottom+EPS)holes.s.push([corridor.x-room.x,cr-room.x]);
    if(corridor.x<room.x-EPS&&cr>=room.x-EPS)holes.w.push([corridor.y-room.y,cb-room.y]);
    if(cr>right+EPS&&corridor.x<=right+EPS)holes.e.push([corridor.y-room.y,cb-room.y]);
  }
  for(const object of objects){
    const door=doorWallPlacement(object,rooms);if(!door)continue;
    if(door.axis==='x'){
      if(Math.abs(door.line-room.y)<=EPS)holes.n.push([door.start-room.x,door.end-room.x]);
      if(Math.abs(door.line-bottom)<=EPS)holes.s.push([door.start-room.x,door.end-room.x]);
    }else{
      if(Math.abs(door.line-room.x)<=EPS)holes.w.push([door.start-room.y,door.end-room.y]);
      if(Math.abs(door.line-right)<=EPS)holes.e.push([door.start-room.y,door.end-room.y]);
    }
  }
  return{n:remaining(room.width,holes.n),s:remaining(room.width,holes.s),e:remaining(room.height,holes.e),w:remaining(room.height,holes.w)};
}
export function wallPath(room,rooms,objects=[]){
  if(room.open)return'';
  return Object.entries(wallSegments(room,rooms,objects)).flatMap(([side,segments])=>segments.map(([a,b])=>side==='n'?`M${a} 0H${b}`:side==='s'?`M${a} ${room.height}H${b}`:side==='w'?`M0 ${a}V${b}`:`M${room.width} ${a}V${b}`)).join('');
}
