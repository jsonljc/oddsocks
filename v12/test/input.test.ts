import { inputFromKeys } from '../src/app/input';

describe('inputFromKeys', () => {
  it('is neutral with nothing held', () => {
    expect(inputFromKeys(new Set())).toMatchObject({ moveX: 0, moveY: 0, run: false });
  });

  it('maps WASD and arrows to the same axes', () => {
    expect(inputFromKeys(new Set(['KeyW'])).moveY).toBe(-1);
    expect(inputFromKeys(new Set(['ArrowUp'])).moveY).toBe(-1);
    expect(inputFromKeys(new Set(['KeyD'])).moveX).toBe(1);
  });

  it('cancels opposing keys instead of drifting', () => {
    expect(inputFromKeys(new Set(['KeyA', 'KeyD'])).moveX).toBe(0);
  });

  it('reads shift as run', () => {
    expect(inputFromKeys(new Set(['ShiftLeft'])).run).toBe(true);
  });

  it('maps the door and hide keys added in Task 5A', () => {
    expect(inputFromKeys(new Set(['KeyF'])).action).toBe('door');
    expect(inputFromKeys(new Set(['KeyC'])).action).toBe('hide');
  });

  it('resolves two action keys the same way every time', () => {
    const held = new Set(['KeyF', 'KeyE']);
    expect(inputFromKeys(held).action).toBe('interact');
    expect(inputFromKeys(held).action).toBe('interact');
  });
});
