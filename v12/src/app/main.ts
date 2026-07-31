import { createStage } from '../render/stage';
import { runMorningScene } from './scenes/morning';
import { runNightScene } from './scenes/night';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1234);
const night = Number(params.get('night') ?? 6);

// The brief's own replacement block for this file drops the `.catch` below
// silently — found by diffing against what was actually shipped in Task 11.
// Kept: it is real error handling Task 11 added on purpose, not incidental to
// the routing branch this task adds.
if (params.get('scene') === 'morning') {
  runMorningScene(document.body, night);
} else {
  createStage(document.body)
    .then(stage => runNightScene(stage, seed, night))
    .catch(err => { console.error('failed to start the night scene', err); });
}
