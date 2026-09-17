// YOU HAVE TO BE ABLE TO SEE THE BALL TO AIM A PUTT.
//
// In a simulator bay the eye is at eye height with the ball a metre in front, so
// the ball is about sixty degrees below the view axis -- far outside a frame that
// is nineteen degrees to the top edge. For a full shot that is right: the ball is
// below your eyeline in the room too, and you are looking at where it is going.
// For a putt it is useless. You are aiming at a hole a few metres away and the
// ball has to be on screen to aim from.
//
// So on the green the camera backs off until the ball is inside the frame. Not a
// different rig -- the same eye height, the same line, the same field of view --
// just far enough back that the geometry works:
//
//   distance = height / tan(halfFov * BALL_FRAME)
//
// BALL_FRAME is how much of the half-angle the ball is allowed to use. At 0.85 it
// sits just inside the bottom edge with margin for the axis's own slight downward
// tilt, and -- deliberately -- it is a NO-OP for the broadcast rig, which at nine
// metres up and twenty-three back already has the ball at 81% of its half-angle.
// A camera that is already showing the ball is not moved.
export const BALL_FRAME=.85;
export function framedForBall(rig){
 const half=(rig.fov??53)*Math.PI/360*BALL_FRAME;
 const need=rig.height/Math.tan(half);
 return need>rig.distance?{...rig,distance:need}:rig;
}

// Shared camera math; a lateral offset translates both eye and target equally.
export function playerCameraPose(hole,p,aim,config){
 const a=aim*Math.PI/180,dx=Math.sin(a),dz=Math.cos(a),rx=Math.cos(a),rz=-Math.sin(a),y=hole.height(p.x,p.z);
 const eye=hole.toWorld({x:p.x-dx*config.distance+rx*config.offset,y:y+config.height,z:p.z-dz*config.distance+rz*config.offset});
 const target=hole.toWorld({x:p.x+dx*90+rx*config.offset,y:y-1,z:p.z+dz*90+rz*config.offset});
 return {eye,target};
}

// Closing on the hole, the camera comes in with the ball. A putt is already
// near; a long approach trickling up to the flag earns the same look, because a
// ball dropping from 24 m back and 11 m up is a white speck vanishing.
//
// Nearness to the pin is not enough on its own. A shot flying over the green at
// height passes directly above the hole, and on distance alone that would haul
// the camera to the turf while the ball is still thirty metres up. So height
// above the ground gates it too, and both have to be small.
const APPROACH_FAR=15, APPROACH_NEAR=1.2, GROUND_REACH=2.6;
// Putts are followed from the side rather than from directly behind. Down the
// line you are looking along the roll and the break is edge on -- the one thing
// a putt is about is the hardest thing to see. A quarter turn round the ball
// puts the roll across the screen and the ball goes into the cup in front of
// you instead of away from you. Flip the sign to watch from the other side.
const PUTT_VIEW=45*Math.PI/180;
// Full shots are followed from off the shoulder too, not from dead behind.
//
// Directly behind the ball is the worst seat in the house: the ball is a dot on
// its own trail, and every shot looks identical because there is no across-frame
// motion to read. A quarter turn is right for a putt, where the whole question is
// the break; a full shot needs less, because the hole has to stay in frame and
// the pin sits almost straight down the flight line. 25 degrees against a half
// field of view near 32 leaves the pin inside the frame rather than hard on its
// edge, and the look-ahead below carries it further in.
const FLIGHT_VIEW=25*Math.PI/180;
// How far past the ball the camera looks, as a fraction of how far back it sits.
// Looking straight at the ball puts the pin the full FLIGHT_VIEW off-axis; biasing
// the view this far toward the hole rotates the axis by roughly half of that, so
// the ball and the hole end up about equally off centre instead of the hole
// hanging on the edge. Capped at half the remaining distance so it can never look
// past the hole itself.
const LOOK_AHEAD=.8, LOOK_CAP=.5;
// Where the camera sits at its widest and where the long approach brings it, over
// the WHOLE shot rather than only the last few metres. The second, much tighter
// move is CLOSE_DISTANCE below and is gated on height as well.
const TRACK_FAR=150, TRACK_NEAR=18;
const TRACK_WIDE_DISTANCE=24, TRACK_TIGHT_DISTANCE=13;
const TRACK_WIDE_HEIGHT=11, TRACK_TIGHT_HEIGHT=6.5;
const CLOSE_DISTANCE=1.45, CLOSE_HEIGHT=.6;
// Below this the bearing to the hole is meaningless -- at the cup it is undefined
// and one step either side of it swings a full half turn -- so it hands back to
// the shot's own aim, blended in over the metres above it rather than snapped.
const BEARING_FLOOR=1.5, BEARING_BLEND=9;
const clamp01=v=>v<0?0:v>1?1:v;
// Smoothstep, so the move in and back out has no corner in it.
const ease=v=>v*v*(3-2*v);
// Shortest way round, so a bearing blend never takes the long way through a wrap.
const wrap=d=>{while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};

export function approachCloseness(hole,p){
 if(!hole?.pin)return 0;
 const flat=Math.hypot(p.x-hole.pin.x,p.z-hole.pin.z);
 const lift=p.y-hole.height(p.x,p.z);
 const near=1-clamp01((flat-APPROACH_NEAR)/(APPROACH_FAR-APPROACH_NEAR));
 const low=1-clamp01((lift-.12)/GROUND_REACH);
 return ease(near*low);
}

// The broad half of "the closer to the hole, the closer the camera". Distance to
// the pin only -- no height gate, because this one is a gentle tightening of the
// frame rather than the drop to turf level that `approachCloseness` drives, and
// gating it on height would leave a shot that never gets low filmed from as far
// away at the green as it was off the tee.
export function trackCloseness(hole,p){
 if(!hole?.pin)return 0;
 const flat=Math.hypot(p.x-hole.pin.x,p.z-hole.pin.z);
 return ease(1-clamp01((flat-TRACK_NEAR)/(TRACK_FAR-TRACK_NEAR)));
}

// Which way the camera trails from: along the line to the HOLE, not along the
// line the ball was struck on. Those differ on anything that curves, and it is
// the hole that has to stay in frame.
export function followBearing(hole,p,aim){
 const shot=aim*Math.PI/180+(hole?.rotation??0);
 if(!hole?.pin)return shot;
 const dx=hole.pin.x-p.x,dz=hole.pin.z-p.z,flat=Math.hypot(dx,dz);
 if(flat<=BEARING_FLOOR)return shot;
 const toPin=Math.atan2(dx,dz)+hole.rotation;
 return shot+wrap(toPin-shot)*ease(clamp01((flat-BEARING_FLOOR)/(BEARING_BLEND-BEARING_FLOOR)));
}

export function flightCameraPose(hole,p,aim,putting=false){
 const ball=hole.toWorld(p);
 // A putt keeps trailing its own aim: the line it was struck on is the thing
 // being judged, and the cup is a metre away in any case.
 const base=putting?aim*Math.PI/180+hole.rotation:followBearing(hole,p,aim);
 const a=base+(putting?PUTT_VIEW:FLIGHT_VIEW);
 const close=approachCloseness(hole,p),track=putting?0:trackCloseness(hole,p);
 const wide=putting?2.4:TRACK_WIDE_DISTANCE+(TRACK_TIGHT_DISTANCE-TRACK_WIDE_DISTANCE)*track;
 const tall=putting?1.5:TRACK_WIDE_HEIGHT+(TRACK_TIGHT_HEIGHT-TRACK_WIDE_HEIGHT)*track;
 const distance=wide*(1-close)+CLOSE_DISTANCE*close;
 const height=tall*(1-close)+CLOSE_HEIGHT*close;
 const eye={x:ball.x-Math.sin(a)*distance,y:p.y+height,z:ball.z-Math.cos(a)*distance};
 // Look a little past the ball toward the hole, so both are in frame. A putt is
 // framed on the ball itself, which is what makes the break readable.
 if(putting)return {eye,target:{x:ball.x,y:p.y,z:ball.z}};
 // A hole with no pin has nothing to lead toward, and dereferencing one that is
 // not there threw -- the bearing and both closeness functions already guarded
 // for it and this did not. With no pin the lead is zero and the camera frames
 // the ball, which is the only sensible thing to look at.
 const toPin=hole?.pin?Math.hypot(hole.pin.x-p.x,hole.pin.z-p.z):0;
 const lead=Math.min(distance*LOOK_AHEAD,toPin*LOOK_CAP);
 return {eye,target:{x:ball.x+Math.sin(base)*lead,y:p.y,z:ball.z+Math.cos(base)*lead}};
}

// THE PUTT FOLLOW: the same camera, pointed at the hole.
//
// There is one camera for every shot -- that was settled when the separate putt
// rig was removed, and nothing here brings it back. The eye is exactly where
// `flightCameraPose` puts it for any other shot. What changes is the LOOK: while
// the ball is rolling on the green the target is pinned to the cup instead of
// leading the ball, so the hole sits still on screen while the putt moves toward
// it. Framed on the ball, the cup drifts around the frame during the one roll
// you are watching to see whether it drops.
//
// A hole with no pin -- the practice bench, a malformed course -- falls straight
// back to the ordinary pose rather than dereferencing something that is not
// there.
export function followPose(hole,p,aim,aimAtCup=false){
 const pose=flightCameraPose(hole,p,aim,false);
 if(!aimAtCup||!hole?.pin)return pose;
 const cup=hole.toWorld(hole.pin);
 return {eye:pose.eye,target:{x:cup.x,y:hole.height(hole.pin.x,hole.pin.z),z:cup.z}};
}
