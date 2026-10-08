// A faster octree query for cannon-es trimeshes.
//
// cannon-es 0.20's OctreeNode.aabbQuery walks every node of the tree on
// every query: it only tests overlap before taking a node's triangles, never
// before descending, and it grows a fresh queue array as it goes. Every wheel
// ray and every hull contact test runs it against every road chunk and the
// terrain patch, every physics step, which was most of the garbage the game
// made while driving (and the GC pauses that came with it). This version
// skips branches that miss the box (a child's box lies inside its parent's,
// so nothing is lost) and reuses one stack.

import * as CANNON from 'cannon-es';

const stack = [];

export function patchOctreeQuery() {
  const shape = new CANNON.Trimesh([0, 0, 0, 1, 0, 0, 0, 0, 1], [0, 1, 2]);
  const nodeProto = Object.getPrototypeOf(Object.getPrototypeOf(shape.tree));
  if (!nodeProto || typeof nodeProto.aabbQuery !== 'function' || nodeProto.aabbQuery.patched) return false;

  function aabbQuery(aabb, result) {
    let top = 0;
    stack[top++] = this;
    while (top > 0) {
      const node = stack[--top];
      stack[top] = null;
      if (!node.aabb.overlaps(aabb)) continue;
      const data = node.data;
      for (let i = 0; i < data.length; i += 1) result.push(data[i]);
      const children = node.children;
      for (let i = 0; i < children.length; i += 1) stack[top++] = children[i];
    }
    return result;
  }
  aabbQuery.patched = true;
  nodeProto.aabbQuery = aabbQuery;
  return true;
}
