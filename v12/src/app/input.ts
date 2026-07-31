import type { Input } from '../core/sim';

export type UiAction = 'place' | 'pickup' | 'interact' | 'door' | 'hide' | null;
export interface ReadInput extends Input { action: UiAction }

/** Keys are checked in a fixed order so that two held at once resolve the same
 *  way every frame — determinism reaches all the way out to the keyboard. */
export function inputFromKeys(held: ReadonlySet<string>): ReadInput {
  const axis = (neg: string[], pos: string[]) =>
    (pos.some(k => held.has(k)) ? 1 : 0) - (neg.some(k => held.has(k)) ? 1 : 0);
  const action: UiAction =
    held.has('KeyE') ? 'interact' :
    held.has('KeyQ') ? 'place' :
    held.has('KeyF') ? 'door' :
    held.has('KeyC') ? 'hide' : null;
  return {
    moveX: axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
    moveY: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    run: held.has('ShiftLeft') || held.has('ShiftRight'),
    action,
  };
}

export function createInput(target: Window): { read(): ReadInput; dispose(): void } {
  const held = new Set<string>();
  const down = (e: KeyboardEvent) => held.add(e.code);
  const up = (e: KeyboardEvent) => held.delete(e.code);
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return {
    read: () => inputFromKeys(held),
    dispose: () => { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); },
  };
}
