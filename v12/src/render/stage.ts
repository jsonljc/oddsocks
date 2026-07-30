import { Application, Container } from 'pixi.js';
import type { Vec2 } from '../core/geometry';

export interface Stage { app: Application; world: Container; centreOn(p: Vec2): void }

export async function createStage(el: HTMLElement): Promise<Stage> {
  const app = new Application();
  await app.init({ background: 0x0b0a10, resizeTo: window, antialias: true });
  el.appendChild(app.canvas);
  const world = new Container();
  app.stage.addChild(world);
  return {
    app, world,
    centreOn(p) {
      world.x = app.screen.width / 2 - p.x;
      world.y = app.screen.height / 2 - p.y;
    },
  };
}
