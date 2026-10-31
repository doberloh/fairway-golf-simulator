# PEOPLE, ONE BODY FOR EVERY FIGURE (the owner's review, 30 October 2026:
# "the human cartoon models need more iteration and variety"; "crowds need
# more variety"). The walkers, the greenkeeper on the mower and the
# spectators were three bodies built three ways; now one cartoon body with
# poses, hats, a skirt and props, used by architect_life.py and
# architect_occasion.py. Iterations are logged in docs/ARCHITECT_COURSES.md,
# *Blender iteration log*, under the people.
#
# Faces -Y, stands on Z = 0, in metres (1.75 m for an adult). Every part
# carries ONE role, and the game colours each role per figure (renderer.js,
# PEOPLE_PALETTE), so one model makes many people:
#
#   stone   skin           accent  shirt (or the mower's paint, a bib)
#   bark    trousers/skirt dirt    shoes, hair, tyres, a trolley's frame
#   leaf    cap or hat, and the bag or umbrella, which match it
import math
from mathutils import Vector

V = Vector


def soft(lo, hi):
    return lambda p, n: lo + (hi - lo) * max(0.0, n.z)


def person(mesh, rng, pose='walk', hat='cap', bag=None, skirt=False, size=1.0, head=1.0, at=(0, 0, 0), hip=None):
    """Adds a person to `mesh`. pose: walk, stand, clap, cheer, push, pull,
    umbrella, seated. hat: cap, visor, sunhat, bucket, none. bag: None,
    'back' (carried on the shoulder). `size` scales the body (a child is
    about .62 with `head` 1.25); `at` moves it; `hip` sets a seated hip."""
    s = size
    ox, oy, oz = at
    P = lambda x, y, z: V((ox + x * s, oy + y * s, oz + z * s))
    R = lambda *r: tuple(v * s for v in r)
    seated = pose == 'seated'
    hz = (hip - oz) / s if hip is not None else .9

    # LEGS AND SHOES. Walking, one stride forward and one back with the knee
    # of the back leg bent; seated, thighs forward and shins down.
    if seated:
        for x in (-.1, .1):
            # Iteration 4: the feet on a footplate .42 below the seat (they hung
            # to the ground, the shins showing under the mower).
            mesh.add_tube([P(x, .05, hz), P(x, -.38, hz + .02), P(x, -.44, hz - .38)], R(.08, .07, .055), 7, 'bark', rng,
                          shade=lambda co, t: .9 - .15 * t)
            mesh.add_lump(P(x, -.5, hz - .42), R(.055, .12, .05), 'dirt', rng, subdiv=1, jitter=0)
    else:
        if pose == 'walk' or pose in ('push', 'pull'):
            legs = ((-.1, -.24, -.05), (.1, .2, .12))   # x, foot y, knee y offset
        else:
            legs = ((-.1, -.02, -.02), (.1, .03, -.02))
        for x, fy, ky in legs:
            # Iteration 2: stouter (were .085-.056), sticks on the sheet.
            mesh.add_tube([P(x, 0, hz), P(x, fy * .45 + ky, .48), P(x, fy, .09)], R(.098, .08, .064), 7, 'bark', rng,
                          shade=lambda co, t: .95 - .2 * t)
            mesh.add_lump(P(x, fy - .045, .055), R(.06, .125, .055), 'dirt', rng, subdiv=1, jitter=0,
                          shade=soft(.7, 1.0))
    if skirt and not seated:
        # A skirt or skort: a short flared bell over the hips.
        mesh.add_lump(P(0, 0, hz - .05), R(.22, .17, .2), 'bark', rng, subdiv=2, jitter=0, squash_bottom=.35,
                      shade=soft(.8, 1.05))

    # BODY: hips in the trousers' colour, a shirt over a chest a little wider
    # than the hips, shoulders rounded off.
    mesh.add_lump(P(0, 0, hz + .02), R(.19, .13, .1), 'bark', rng, subdiv=2, jitter=0)
    # Iteration 5: a belt where the shirt is tucked in, in the shoes' colour.
    mesh.add_lump(P(0, 0, hz + .08), R(.197, .137, .022), 'dirt', rng, subdiv=2, jitter=0)
    mesh.add_lump(P(0, 0, hz + .3), R(.2, .14, .28), 'accent', rng, subdiv=2, jitter=.01, shade=soft(.78, 1.08))
    mesh.add_lump(P(0, 0, hz + .5), R(.235, .14, .1), 'accent', rng, subdiv=2, jitter=0, shade=soft(.85, 1.1))
    sh = hz + .52   # shoulder height

    # ARMS: a short sleeve in the shirt's colour, then a bare forearm and a
    # hand. Where each hand goes is the pose.
    hands = {
        'walk': ((-.27, .14, hz + .02), (.27, -.16, hz + .04)),
        'stand': ((-.25, .02, hz - .02), (.25, .02, hz - .02)),
        'clap': ((-.03, -.27, hz + .38), (.03, -.27, hz + .4)),
        'cheer': ((-.36, -.04, hz + 1.12), (.36, -.04, hz + 1.12)),
        'push': ((-.2, -.42, hz + .1), (.2, -.42, hz + .1)),
        'pull': ((-.26, -.06, hz + .0), (.27, .38, hz + .02)),
        'umbrella': ((-.25, .02, hz - .02), (.24, -.14, hz + .42)),
        'seated': ((-.17, -.5, hz + .2), (.17, -.5, hz + .2)),
    }[pose]
    for side, hand in zip((-1, 1), hands):
        sx = side * .245
        shoulder = P(sx, 0, sh)
        hx, hy, hzz = hand
        # The elbow halfway, pushed out and back a little.
        ex, ey, ez = (sx + hx) / 2 + side * .05, (0 + hy) / 2 + .05, (sh + hzz) / 2
        elbow = P(ex, ey, ez)
        mid = P(sx + (ex - sx) * .55, ey * .55, sh + (ez - sh) * .55)
        mesh.add_tube([shoulder, mid], R(.065, .06), 6, 'accent', rng)
        mesh.add_tube([mid, elbow, P(hx, hy, hzz)], R(.045, .042, .038), 6, 'stone', rng)
        mesh.add_lump(P(hx, hy, hzz - .02), R(.045, .045, .05), 'stone', rng, subdiv=1, jitter=0)

    # HEAD: a neck, a head a little large (the cartoon hand), a nose, ears,
    # hair at the back and sides under the hat.
    hs = head
    nz = sh + .08
    mesh.add_tube([P(0, 0, sh - .02), P(0, 0, nz + .04)], R(.055, .05), 6, 'stone', rng)
    cz = nz + .13 * hs
    mesh.add_lump(P(0, 0, cz), R(.115 * hs, .125 * hs, .135 * hs), 'stone', rng, subdiv=2, jitter=0,
                  shade=soft(.85, 1.05))
    mesh.add_lump(P(0, -.12 * hs, cz - .01), R(.025, .03, .03), 'stone', rng, subdiv=1, jitter=0)
    # Iteration 5: eyes, two dark dots (a blank face read as a mannequin
    # from 8 m), in the hair's colour.
    for x in (-1, 1):
        mesh.add_lump(P(x * .042 * hs, -.113 * hs, cz + .025 * hs), R(.016, .01, .02), 'dirt', rng, subdiv=1, jitter=0)
    if skirt:
        # A ponytail at the back of the head.
        mesh.add_tube([P(0, .1 * hs, cz + .04 * hs), P(0, .17 * hs, cz - .05 * hs), P(0, .15 * hs, cz - .16 * hs)],
                      R(.045, .04, .02), 6, 'dirt', rng)
    for x in (-1, 1):
        mesh.add_lump(P(x * .115 * hs, .0, cz), R(.02, .035, .04), 'stone', rng, subdiv=1, jitter=0)
    mesh.add_lump(P(0, .03 * hs, cz + .04 * hs), R(.12 * hs, .115 * hs, .11 * hs), 'dirt', rng, subdiv=2, jitter=0,
                  squash_bottom=.2)
    top = cz + .1 * hs
    if hat == 'cap':
        mesh.add_lump(P(0, .01, top), R(.125 * hs, .13 * hs, .07 * hs), 'leaf', rng, subdiv=2, jitter=0,
                      squash_bottom=.9, shade=soft(.85, 1.1))
        mesh.add_lump(P(0, -.13 * hs, top - .02 * hs), R(.09 * hs, .09 * hs, .015), 'leaf', rng, subdiv=1, jitter=0)
    elif hat == 'visor':
        mesh.add_lump(P(0, -.12 * hs, top - .03 * hs), R(.1 * hs, .09 * hs, .014), 'leaf', rng, subdiv=1, jitter=0)
        mesh.add_tube([P(-.12 * hs, -.02, top - .03 * hs), P(0, .12 * hs, top - .02 * hs), P(.12 * hs, -.02, top - .03 * hs)],
                      R(.02, .02, .02), 5, 'leaf', rng)
    elif hat == 'sunhat':
        mesh.add_lump(P(0, 0, top - .02 * hs), R(.27 * hs, .27 * hs, .018), 'leaf', rng, subdiv=2, jitter=0)
        mesh.add_lump(P(0, .0, top + .02 * hs), R(.12 * hs, .125 * hs, .08 * hs), 'leaf', rng, subdiv=2, jitter=0,
                      squash_bottom=.9, shade=soft(.85, 1.1))
    elif hat == 'bucket':
        mesh.add_lump(P(0, 0, top - .03 * hs), R(.18 * hs, .18 * hs, .03), 'leaf', rng, subdiv=2, jitter=0,
                      squash_bottom=.6)
        mesh.add_lump(P(0, .0, top + .02 * hs), R(.125 * hs, .13 * hs, .08 * hs), 'leaf', rng, subdiv=2, jitter=0,
                      squash_bottom=.9)

    # PROPS.
    if bag == 'back':
        # A carry bag slung on the back, the strap across the chest, three
        # club heads at the top.
        b0, b1 = P(.13, .2, hz - .25), P(-.1, .24, sh + .2)
        mesh.add_tube([b0, b1], R(.11, .1), 8, 'leaf', rng, shade=lambda co, t: .85 + .2 * t)
        mesh.add_tube([P(.2, -.08, hz + .1), P(-.2, -.12, sh + .02)], R(.018, .018), 4, 'leaf', rng)
        for k in range(3):
            mesh.add_tube([P(-.1 + k * .03, .24, sh + .2), P(-.12 + k * .04, .27, sh + .38)], R(.016, .016), 4, 'dirt', rng)
            mesh.add_lump(P(-.12 + k * .04, .28, sh + .4), R(.035, .05, .03), 'dirt', rng, subdiv=1, jitter=0)
    if pose == 'push':
        # A three-wheeled push trolley in front: the bag on it, handle at the
        # hands, two wheels at the back of the frame and one in front.
        hy, hh = -.42, hz + .1
        mesh.add_tube([P(-.2, hy, hh), P(.2, hy, hh)], R(.02, .02), 5, 'dirt', rng)
        for x in (-.2, .2):
            mesh.add_tube([P(x, hy, hh), P(x * 1.4, -.62, .25), P(x * 1.6, -.7, .2)], R(.02, .02, .02), 5, 'dirt', rng)
            mesh.add_tube([P(x * 1.6 - .03, -.7, .2), P(x * 1.6 + .03, -.7, .2)], R(.2, .2), 10, 'dirt', rng)
        mesh.add_tube([P(0, -.6, .3), P(0, -1.25, .12)], R(.02, .02), 5, 'dirt', rng)
        mesh.add_tube([P(-.03, -1.25, .12), P(.03, -1.25, .12)], R(.12, .12), 10, 'dirt', rng)
        mesh.add_tube([P(0, -.85, .3), P(0, -.66, 1.0)], R(.12, .11), 8, 'leaf', rng, shade=lambda co, t: .85 + .2 * t)
        for k in range(3):
            mesh.add_lump(P(-.04 + k * .04, -.64, 1.08), R(.035, .05, .03), 'dirt', rng, subdiv=1, jitter=0)
    if pose == 'pull':
        # A two-wheeled pull trolley behind, its handle in the right hand.
        mesh.add_tube([P(.27, .38, hz + .02), P(.2, .9, .3)], R(.018, .018), 4, 'dirt', rng)
        # Iteration 4: the bag full size (it read as a small bin behind).
        mesh.add_tube([P(.2, .92, .22), P(.2, 1.12, 1.05)], R(.13, .12), 8, 'leaf', rng, shade=lambda co, t: .85 + .2 * t)
        for x in (.0, .4):
            mesh.add_tube([P(x - .03, 1.0, .17), P(x + .03, 1.0, .17)], R(.17, .17), 10, 'dirt', rng)
        mesh.add_tube([P(0, 1.0, .17), P(.4, 1.0, .17)], R(.015, .015), 4, 'dirt', rng)
        for k in range(3):
            mesh.add_lump(P(.17 + k * .03, 1.17, 1.02), R(.035, .05, .03), 'dirt', rng, subdiv=1, jitter=0)
    if pose == 'umbrella':
        # A golf umbrella: a shaft from the right hand, a wide shallow dome.
        # Iteration 2: held to the side (the shaft ran in front of the face),
        # the canopy over the head and a little smaller.
        mesh.add_tube([P(.24, -.14, hz + .3), P(.16, -.06, 2.16)], R(.015, .015), 4, 'dirt', rng)
        mesh.add_lump(P(.14, -.04, 2.05), (.6 * s, .6 * s, .24 * s), 'leaf', rng, subdiv=2, jitter=0, squash_bottom=.85,
                      shade=soft(.75, 1.1))
