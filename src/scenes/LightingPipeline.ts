import Phaser from 'phaser';
import display from '../data/display.json';

export const LIGHTING_PIPELINE = 'lighting';
const MASK_UNIT = 1;
const GLOW_COUNT = 3;

const { lighting } = display;
const vec3 = (rgb: number[]): string => `vec3(${rgb.map((value) => value.toFixed(3)).join(', ')})`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform sampler2D uMask;
uniform vec4 uView;
uniform vec2 uWorld;
uniform vec2 uDrift;
uniform vec4 uPool;
uniform vec3 uGlows[${GLOW_COUNT}];
uniform float uFlicker;
varying vec2 outTexCoord;

void main() {
  vec4 source = texture2D(uMainSampler, outTexCoord);
  vec3 color = source.rgb;
  vec2 world = uView.xy + vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uView.zw;

  float shade = texture2D(uMask, (world + uDrift) / uWorld).r * ${lighting.shadeStrength.toFixed(3)};
  color = mix(color, color * ${vec3(lighting.shadeTint)}, shade);

  color *= ${vec3(lighting.warmGrade)};
  vec2 poolOffset = (world - uPool.xy) / uPool.zw;
  color += clamp(1.0 - dot(poolOffset, poolOffset), 0.0, 1.0) * ${vec3(lighting.poolAdd)};

  float fire = clamp(1.0 - distance(world, uGlows[0].xy) / uGlows[0].z, 0.0, 1.0);
  float gate = clamp(1.0 - distance(world, uGlows[1].xy) / uGlows[1].z, 0.0, 1.0);
  float burrow = clamp(1.0 - distance(world, uGlows[2].xy) / uGlows[2].z, 0.0, 1.0);
  color += pow(fire, 1.5) * uFlicker * ${vec3(lighting.glowFire)} * ${lighting.glowStrength.toFixed(3)};
  color += pow(gate, 1.5) * ${vec3(lighting.glowGate)} * ${lighting.glowStrength.toFixed(3)};
  color += pow(burrow, 1.5) * ${vec3(lighting.glowBurrow)} * ${lighting.glowStrength.toFixed(3)};

  vec2 edge = (outTexCoord - 0.5) / ${lighting.vignetteRadius.toFixed(3)};
  color *= 1.0 - clamp(dot(edge, edge), 0.0, 1.0) * ${lighting.vignetteStrength.toFixed(3)};

  gl_FragColor = vec4(color, source.a);
}
`;

export interface LightSpot {
  x: number;
  y: number;
  radius: number;
}

export interface LightingSetup {
  maskKey: string;
  worldWidth: number;
  worldHeight: number;
  pool: { x: number; y: number; radiusX: number; radiusY: number };
  /** เรียงตาม กองไฟ เกต โพรง */
  glows: [LightSpot, LightSpot, LightSpot];
}

/** ชั้นแสงทั้งหมดอยู่ในรอบวาดเดียวบนการ์ดจอ เบากว่าการซ้อนภาพเต็มจอหลายชั้น */
export class LightingPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private setup: LightingSetup | null = null;

  constructor(game: Phaser.Game) {
    super({ game, name: LIGHTING_PIPELINE, fragShader: FRAGMENT });
  }

  configure(setup: LightingSetup): void {
    this.setup = setup;
  }

  override onPreRender(): void {
    const { setup } = this;
    const camera = this.game.scene.getScene('Base')?.cameras.main;
    if (!setup || !camera) return;
    const time = this.game.loop.time;
    const view = camera.worldView;
    this.set1i('uMask', MASK_UNIT);
    this.set4f('uView', view.x, view.y, view.width, view.height);
    this.set2f('uWorld', setup.worldWidth, setup.worldHeight);
    this.set2f(
      'uDrift',
      Math.sin(time * lighting.driftSpeed) * lighting.driftPx,
      Math.cos(time * lighting.driftSpeed * 0.7) * lighting.driftPx,
    );
    this.set4f('uPool', setup.pool.x, setup.pool.y, setup.pool.radiusX, setup.pool.radiusY);
    this.set3fv('uGlows', new Float32Array(setup.glows.flatMap((glow) => [glow.x, glow.y, glow.radius])));
    this.set1f('uFlicker', 1 + Math.sin(time * 0.009) * Math.sin(time * 0.0031) * lighting.flickerAmount);
  }

  override onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    const { setup } = this;
    if (setup) {
      const source = this.game.textures.get(setup.maskKey).source[0];
      if (source?.glTexture) this.bindTexture(source.glTexture, MASK_UNIT);
    }
    this.bindAndDraw(renderTarget);
  }
}
