export type GearDrawSpec = {
  /** teeth count */
  teeth: number;
  /** outer radius px */
  outerR: number;
  /** root radius px */
  rootR: number;
  /** bore radius px */
  holeR: number;
  /** center x px */
  x: number;
  /** center y px */
  y: number;
  /** rotation rad */
  angle: number;
  /** +1 CW, -1 CCW */
  dir: 1 | -1;
};

/** Spur gear outline centered at 0,0 — zaokrąglone zęby, gładka korona. */
export function traceGearPath(
  ctx: CanvasRenderingContext2D,
  teeth: number,
  outerR: number,
  rootR: number,
) {
  const step = (Math.PI * 2) / teeth;
  const tipSpread = step * 0.34;
  const flank = step * 0.1;

  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const base = i * step;
    const aRoot0 = base - step * 0.5 + flank;
    const aTip0 = base - tipSpread * 0.5;
    const aTip1 = base + tipSpread * 0.5;
    const aRoot1 = base + step * 0.5 - flank;

    const pt = (a: number, r: number) => ({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
    });

    const r0 = pt(aRoot0, rootR);
    const t0 = pt(aTip0, outerR);
    const t1 = pt(aTip1, outerR);
    const r1 = pt(aRoot1, rootR);

    if (i === 0) ctx.moveTo(r0.x, r0.y);
    else ctx.lineTo(r0.x, r0.y);

    ctx.lineTo(t0.x, t0.y);
    // zaokrąglony czubek zęba
    ctx.quadraticCurveTo(
      Math.cos(base) * (outerR + 0.8),
      Math.sin(base) * (outerR + 0.8),
      t1.x,
      t1.y,
    );
    ctx.lineTo(r1.x, r1.y);
  }
  ctx.closePath();
}

function ringGradient(
  ctx: CanvasRenderingContext2D,
  r: number,
  light: string,
  dark: string,
) {
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, light);
  g.addColorStop(0.45, dark);
  g.addColorStop(1, light);
  return g;
}

export function drawMetallicGear(
  ctx: CanvasRenderingContext2D,
  spec: GearDrawSpec,
  intensity: number,
) {
  const { teeth, outerR, rootR, holeR, x, y, angle } = spec;
  const hi = Math.min(1.5, Math.max(0.85, intensity));
  const step = (Math.PI * 2) / teeth;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Drop shadow (głębokość 3D)
  ctx.save();
  traceGearPath(ctx, teeth, outerR, rootR);
  ctx.shadowColor = 'rgba(0,0,0,0.72)';
  ctx.shadowBlur = 18 * hi;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.restore();

  // Korpus — radial dome + tangential shading (obróbka CNC)
  traceGearPath(ctx, teeth, outerR, rootR);
  const dome = ctx.createRadialGradient(-outerR * 0.34, -outerR * 0.42, outerR * 0.04, 0, 0, outerR * 1.08);
  dome.addColorStop(0, `rgba(255, 252, 235, ${0.98 * hi})`);
  dome.addColorStop(0.2, `rgba(240, 210, 120, ${0.98 * hi})`);
  dome.addColorStop(0.45, `rgba(196, 154, 52, ${1 * hi})`);
  dome.addColorStop(0.68, `rgba(120, 88, 28, ${1 * hi})`);
  dome.addColorStop(0.88, `rgba(55, 40, 12, 1)`);
  dome.addColorStop(1, 'rgba(18, 14, 6, 1)');
  ctx.fillStyle = dome;
  ctx.fill();

  // Tarcza — pierścienie guilloché (zegarmistrzowski)
  const guilloche = [outerR * 0.92, outerR * 0.78, rootR * 1.02, rootR * 0.88, holeR * 1.85, holeR * 1.45];
  for (let ri = 0; ri < guilloche.length; ri++) {
    const r = guilloche[ri]!;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const rg = ctx.createLinearGradient(-r, -r * 0.2, r, r * 0.2);
    rg.addColorStop(0, 'rgba(255, 240, 190, 0.22)');
    rg.addColorStop(0.35, 'rgba(0, 0, 0, 0.28)');
    rg.addColorStop(0.65, 'rgba(255, 245, 210, 0.18)');
    rg.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
    ctx.strokeStyle = rg;
    ctx.lineWidth = Math.max(0.6, r * 0.018);
    ctx.stroke();
  }

  // Promienie tarczy (szprychy)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (holeR * 1.5), Math.sin(a) * (holeR * 1.5));
    ctx.lineTo(Math.cos(a) * (rootR * 0.86), Math.sin(a) * (rootR * 0.86));
    const sg = ctx.createLinearGradient(0, 0, Math.cos(a) * rootR, Math.sin(a) * rootR);
    sg.addColorStop(0, 'rgba(255, 235, 180, 0.35)');
    sg.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.strokeStyle = sg;
    ctx.lineWidth = Math.max(0.5, outerR * 0.012);
    ctx.stroke();
  }

  // Wygrawerowane zęby — każdy ząb osobno (flanki + czubek)
  for (let i = 0; i < teeth; i++) {
    const mid = i * step;
    const half = step * 0.17;

    ctx.save();
    ctx.rotate(mid);

    // Cień dolnej krawędzi zęba (slot)
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.moveTo(rootR + 0.5, -half * outerR * 1.1);
    ctx.lineTo(rootR + 0.5, half * outerR * 1.1);
    ctx.lineTo(rootR + outerR * 0.06, half * outerR * 0.85);
    ctx.lineTo(rootR + outerR * 0.06, -half * outerR * 0.85);
    ctx.closePath();
    ctx.fill();

    // Lewa flank (ciemna) / prawa (jasna) — obrotnica
    const flankL = ctx.createLinearGradient(rootR, -half * outerR, outerR, -half * outerR * 0.5);
    flankL.addColorStop(0, 'rgba(0,0,0,0.38)');
    flankL.addColorStop(0.55, 'rgba(80,60,20,0.15)');
    flankL.addColorStop(1, 'rgba(255,255,255,0.22)');
    ctx.fillStyle = flankL;
    ctx.beginPath();
    ctx.moveTo(rootR + 1, -half * outerR * 0.95);
    ctx.lineTo(outerR - 0.8, -half * outerR * 0.55);
    ctx.lineTo(outerR - 0.8, 0);
    ctx.lineTo(rootR + 1, 0);
    ctx.closePath();
    ctx.fill();

    const flankR = ctx.createLinearGradient(rootR, half * outerR, outerR, half * outerR * 0.5);
    flankR.addColorStop(0, 'rgba(255,255,255,0.18)');
    flankR.addColorStop(0.5, 'rgba(200,160,60,0.12)');
    flankR.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = flankR;
    ctx.beginPath();
    ctx.moveTo(rootR + 1, 0);
    ctx.lineTo(outerR - 0.8, 0);
    ctx.lineTo(outerR - 0.8, half * outerR * 0.55);
    ctx.lineTo(rootR + 1, half * outerR * 0.95);
    ctx.closePath();
    ctx.fill();

    // Chromowany czubek zęba
    ctx.strokeStyle = 'rgba(255, 250, 230, 0.55)';
    ctx.lineWidth = Math.max(0.6, outerR * 0.014);
    ctx.beginPath();
    ctx.arc(outerR - 0.4, 0, half * outerR * 0.48, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.restore();
  }

  // Obwódka korony — podwójny bevel
  traceGearPath(ctx, teeth, outerR, rootR);
  ctx.strokeStyle = ringGradient(ctx, outerR, 'rgba(255,248,220,0.92)', 'rgba(45,32,8,0.95)');
  ctx.lineWidth = Math.max(1.4, outerR * 0.028);
  ctx.stroke();
  traceGearPath(ctx, teeth, outerR * 0.97, rootR * 1.01);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(0.5, outerR * 0.01);
  ctx.stroke();

  // Rowek korony (engraved ring)
  ctx.beginPath();
  ctx.arc(0, 0, rootR * 0.94, 0, Math.PI * 2);
  ctx.strokeStyle = ringGradient(ctx, rootR, 'rgba(255,236,180,0.45)', 'rgba(20,15,5,0.85)');
  ctx.lineWidth = Math.max(1, rootR * 0.035);
  ctx.stroke();

  // Wgłębienie slotu
  ctx.beginPath();
  ctx.arc(0, 0, rootR * 0.9, 0, Math.PI * 2);
  const slot = ctx.createRadialGradient(0, 0, rootR * 0.15, 0, 0, rootR);
  slot.addColorStop(0, 'rgba(255,255,255,0.04)');
  slot.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  slot.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = slot;
  ctx.fill();

  // Otwór — stożek + fazowanie
  ctx.beginPath();
  ctx.arc(0, 0, holeR + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fill();
  const bore = ctx.createRadialGradient(-holeR * 0.28, -holeR * 0.35, 0, 0, 0, holeR);
  bore.addColorStop(0, '#6b5428');
  bore.addColorStop(0.4, '#2a2010');
  bore.addColorStop(1, '#030302');
  ctx.beginPath();
  ctx.arc(0, 0, holeR, 0, Math.PI * 2);
  ctx.fillStyle = bore;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, holeR * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  // Połysk metaliczny — podwójny streak
  for (const [ox, oy, rx, ry, op] of [
    [-0.18, -0.32, 0.4, 0.2, 0.48],
    [0.12, -0.08, 0.22, 0.1, 0.22],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(outerR * ox, outerR * oy, outerR * rx, outerR * ry, -0.45, 0, Math.PI * 2);
    const spec = ctx.createRadialGradient(outerR * ox, outerR * oy, 0, outerR * ox, outerR * oy, outerR * rx);
    spec.addColorStop(0, `rgba(255,255,255,${op * hi})`);
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.globalCompositeOperation = 'screen';
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

/** Oblicza pozycję zazęblonego koła na obwodzie (kąt contactAngle rad). */
export function meshPosition(
  parent: { x: number; y: number; outerR: number; teeth: number },
  childOuterR: number,
  contactAngle: number,
) {
  const dist = parent.outerR + childOuterR - 1.5;
  return {
    x: parent.x + Math.cos(contactAngle) * dist,
    y: parent.y + Math.sin(contactAngle) * dist,
  };
}

/** Kąt dziecka zsynchronizowany z rodzicem — przekładnia zębata (ω1·N1 = ω2·N2). */
export function meshAngle(parentAngle: number, parentTeeth: number, childTeeth: number, phase = 0) {
  return phase - (parentAngle * parentTeeth) / childTeeth;
}

export type GearTrainNode = {
  teeth: number;
  outerR: number;
  rootR: number;
  holeR: number;
  x: number;
  y: number;
  dir: 1 | -1;
  /** index rodzica w tablicy, null = master driver */
  parent: number | null;
  contactAngle: number;
  phase: number;
};

export function buildGearTrain(canvasW: number, canvasH: number, mode: 'button' | 'portal'): GearTrainNode[] {
  const s = Math.min(canvasW, canvasH);
  if (mode === 'button') {
    const o0 = s * 0.34;
    const o1 = s * 0.2;
    const cx = canvasW * 0.56;
    const cy = canvasH * 0.5;
    const p1 = meshPosition({ x: cx, y: cy, outerR: o0, teeth: 24 }, o1, Math.PI);
    return [
      { teeth: 24, outerR: o0, rootR: o0 * 0.76, holeR: o0 * 0.22, x: cx, y: cy, dir: 1, parent: null, contactAngle: 0, phase: 0 },
      { teeth: 12, outerR: o1, rootR: o1 * 0.76, holeR: o1 * 0.24, x: p1.x, y: p1.y, dir: -1, parent: 0, contactAngle: Math.PI, phase: Math.PI / 12 },
    ];
  }

  const o0 = s * 0.26;
  const o1 = s * 0.14;
  const o2 = s * 0.095;
  const cx = canvasW * 0.5;
  const cy = canvasH * 0.54;
  const p1 = meshPosition({ x: cx, y: cy, outerR: o0, teeth: 40 }, o1, Math.PI * 0.02);
  const p2 = meshPosition({ x: cx, y: cy, outerR: o0, teeth: 40 }, o2, Math.PI * 0.72);
  return [
    { teeth: 40, outerR: o0, rootR: o0 * 0.76, holeR: o0 * 0.2, x: cx, y: cy, dir: 1, parent: null, contactAngle: 0, phase: 0 },
    { teeth: 20, outerR: o1, rootR: o1 * 0.76, holeR: o1 * 0.22, x: p1.x, y: p1.y, dir: -1, parent: 0, contactAngle: Math.PI * 0.02, phase: Math.PI / 20 },
    { teeth: 14, outerR: o2, rootR: o2 * 0.76, holeR: o2 * 0.24, x: p2.x, y: p2.y, dir: -1, parent: 0, contactAngle: Math.PI * 0.72, phase: Math.PI / 14 },
  ];
}

export function resolveTrainAngles(train: GearTrainNode[], masterAngle: number): number[] {
  const angles = new Array<number>(train.length).fill(0);
  for (let i = 0; i < train.length; i++) {
    const node = train[i]!;
    if (node.parent == null) {
      angles[i] = masterAngle * node.dir;
    } else {
      const p = train[node.parent]!;
      // Kąt rodzica bez znaku dir — sama pozycja kątowa dla przekładni
      const parentAngle = angles[node.parent]! * p.dir;
      angles[i] = meshAngle(parentAngle, p.teeth, node.teeth, node.phase);
    }
  }
  return angles;
}
