import { createStage } from '../render/stage';
import { runNightScene } from './scenes/night';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1234);
const night = Number(params.get('night') ?? 6);

createStage(document.body)
  .then(stage => runNightScene(stage, seed, night))
  .catch(err => { console.error('failed to start the night scene', err); });
