"""
Turns quran.com's Bismillah drawing (public/bismillah.svg, viewBox 0 0 176 36) into absolute
M / L / C / Z commands the reader draws as a SwiftUI Path, arcs turned into curves.

    python scripts/build-bismillah-path.py path/to/bismillah.svg

Writes modules/quran-reader/ios/QuranReaderResources/bismillah.txt: "W H" on the first line, then
the commands.
"""
import math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
svg = open(sys.argv[1], encoding='utf-8').read()
vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
d = re.search(r' d="([^"]+)"', svg).group(1)
tokens = re.findall(r'[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?', d)


def arc_to_cubics(x1, y1, rx, ry, phi, fa, fs, x2, y2):
    """SVG arc endpoint parameterisation to cubic Beziers (the standard conversion)."""
    if rx == 0 or ry == 0:
        return [(x1, y1, x2, y2, x2, y2)]
    phi = math.radians(phi)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    rx, ry = abs(rx), abs(ry)
    lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2
    den = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2
    co = math.sqrt(max(0, num / den)) if den else 0
    if fa == fs:
        co = -co
    cxp, cyp = co * rx * y1p / ry, -co * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2

    def ang(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not fs and dt > 0:
        dt -= 2 * math.pi
    elif fs and dt < 0:
        dt += 2 * math.pi
    n = max(1, math.ceil(abs(dt) / (math.pi / 2)))
    step = dt / n
    out = []
    for i in range(n):
        a1, a2 = t1 + i * step, t1 + (i + 1) * step
        k = 4 / 3 * math.tan((a2 - a1) / 4)

        def pt(a):
            x, y = rx * math.cos(a), ry * math.sin(a)
            return cp * x - sp * y + cx, sp * x + cp * y + cy

        def dpt(a):
            x, y = -rx * math.sin(a), ry * math.cos(a)
            return cp * x - sp * y, sp * x + cp * y

        p1, p2 = pt(a1), pt(a2)
        d1, d2 = dpt(a1), dpt(a2)
        out.append((p1[0] + k * d1[0], p1[1] + k * d1[1], p2[0] - k * d2[0], p2[1] - k * d2[1], p2[0], p2[1]))
    return out


cmds = []
i = 0
cx = cy = sx = sy = 0.0
last_c2 = None
cmd = None
f = lambda v: f'{v:.2f}'.rstrip('0').rstrip('.')
while i < len(tokens):
    if re.match(r'[A-Za-z]', tokens[i]):
        cmd = tokens[i]
        i += 1
        if cmd in 'zZ':
            cmds.append('Z')
            cx, cy = sx, sy
            last_c2 = None
            continue
    rel = cmd.islower()
    C = cmd.upper()
    nums = []
    count = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7}[C]
    for _ in range(count):
        nums.append(float(tokens[i]))
        i += 1
    if C == 'M':
        x, y = nums
        if rel:
            x, y = cx + x, cy + y
        cmds.append(f'M {f(x)} {f(y)}')
        cx, cy, sx, sy = x, y, x, y
        cmd = 'l' if rel else 'L'
        last_c2 = None
    elif C in 'LHV':
        if C == 'L':
            x, y = nums
            if rel:
                x, y = cx + x, cy + y
        elif C == 'H':
            x, y = (cx + nums[0] if rel else nums[0]), cy
        else:
            x, y = cx, (cy + nums[0] if rel else nums[0])
        cmds.append(f'L {f(x)} {f(y)}')
        cx, cy = x, y
        last_c2 = None
    elif C in 'CS':
        if C == 'C':
            x1, y1, x2, y2, x, y = nums
            if rel:
                x1, y1, x2, y2, x, y = cx + x1, cy + y1, cx + x2, cy + y2, cx + x, cy + y
        else:
            x2, y2, x, y = nums
            if rel:
                x2, y2, x, y = cx + x2, cy + y2, cx + x, cy + y
            x1, y1 = (2 * cx - last_c2[0], 2 * cy - last_c2[1]) if last_c2 else (cx, cy)
        cmds.append(f'C {f(x1)} {f(y1)} {f(x2)} {f(y2)} {f(x)} {f(y)}')
        last_c2 = (x2, y2)
        cx, cy = x, y
    elif C == 'A':
        rx, ry, phi, fa, fs, x, y = nums
        if rel:
            x, y = cx + x, cy + y
        for c in arc_to_cubics(cx, cy, rx, ry, phi, int(fa), int(fs), x, y):
            cmds.append('C ' + ' '.join(f(v) for v in c))
        cx, cy = x, y
        last_c2 = None
    else:
        raise SystemExit(f'unsupported command {C}')

out = os.path.join(ROOT, 'modules', 'quran-reader', 'ios', 'QuranReaderResources', 'bismillah.txt')
open(out, 'w').write(f'{f(vb[2])} {f(vb[3])}\n' + ' '.join(cmds) + '\n')
print('commands', len(cmds), 'bytes', os.path.getsize(out))
