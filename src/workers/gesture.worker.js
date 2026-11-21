import { GestureEngine } from '../GestureEngine.js';

const engine = new GestureEngine();
self.onmessage = ({ data: { id, points, target, config } }) => {
  if (config) Object.assign(engine, config);
  self.postMessage({ id, result: target ? engine.scoreFor(points, target) : engine.recognize(points) });
};
