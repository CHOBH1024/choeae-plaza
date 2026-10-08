// Queue boundaries never wrap or create a second provider player.
export function queueTarget(length,index,direction) {
  if(!Number.isInteger(length)||!Number.isInteger(index)||length<1||index<0||index>=length||![-1,1].includes(direction))return null;
  const target=index+direction;
  return target>=0&&target<length?target:null;
}
export function swipeDirection(start,end) {
  const dx=end.x-start.x,dy=end.y-start.y;
  if(Math.abs(dy)<55||Math.abs(dy)<Math.abs(dx)*1.4)return 0;
  return dy<0?1:-1;
}
