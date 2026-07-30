import { makeSink, type MatchEvent } from '../src/core/events';

describe('EventSink', () => {
  it('drains in emission order and empties', () => {
    const sink = makeSink();
    sink.emit({ kind: 'move.enter', tick: 1, night: 1, actor: 'pike', room: 'kitchen', via: 'd_hearth_kitchen' });
    sink.emit({ kind: 'take.warn',  tick: 5, night: 2, actor: 'wren', victim: 'pike', room: 'kitchen' });
    const out = sink.drain();
    expect(out.map(e => e.kind)).toEqual(['move.enter', 'take.warn']);
    expect(sink.drain()).toEqual([]);
  });

  it('narrows on kind', () => {
    const e: MatchEvent = { kind: 'flame.out', tick: 9, night: 3, reason: 'take', remaining: 4 };
    if (e.kind === 'flame.out') expect(e.remaining).toBe(4);
    else throw new Error('narrowing failed');
  });
});
