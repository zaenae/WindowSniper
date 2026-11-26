import { buildHandMesh } from './hand-sdf.js';

self.onmessage = e => {
  const { grip, occluders, step } = e.data;
  const d = buildHandMesh(grip, occluders, { step });
  self.postMessage(d, [d.positions.buffer, d.normals.buffer, d.colors.buffer, d.uvs.buffer, d.indices.buffer, d.trigger.vertices.buffer]);
};
