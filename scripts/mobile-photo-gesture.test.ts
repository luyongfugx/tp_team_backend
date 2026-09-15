import test from "node:test";
import assert from "node:assert/strict";
import { ImageGesture, boundTransform } from "../lib/web/lightbox-gesture";
const bounds = { width: 390, height: 844 };
test("stationary tap closes but a scroll or cancelled pointer does not", () => {
  const gesture = new ImageGesture();
  gesture.down(1, { x: 0, y: 0 });
  assert.equal(gesture.up(1, { x: 2, y: 1 }, bounds), "tap");
  gesture.down(2, { x: 0, y: 0 });
  assert.equal(gesture.up(2, { x: 0, y: 150 }, bounds), undefined);
  gesture.down(3, { x: 0, y: 0 }); gesture.cancel();
  assert.equal(gesture.up(3, { x: 0, y: 0 }, bounds), undefined);
});
test("horizontal swipes navigate only at fit-to-screen size", () => {
  const gesture = new ImageGesture();
  gesture.down(1, { x: 80, y: 0 });
  assert.equal(gesture.up(1, { x: -80, y: 10 }, bounds), "next");
  gesture.down(1, { x: -80, y: 0 });
  assert.equal(gesture.up(1, { x: 80, y: 10 }, bounds), "previous");
  gesture.zoom(2, bounds); gesture.down(1, { x: 80, y: 0 });
  assert.equal(gesture.up(1, { x: -80, y: 10 }, bounds), undefined);
  assert.equal(gesture.transform.x, -160);
});
test("pinch zoom and either finger lift never trigger tap-close or navigation", () => {
  for (const first of [1, 2]) {
    const gesture = new ImageGesture();
    gesture.down(1, { x: -40, y: 0 }); gesture.down(2, { x: 40, y: 0 });
    gesture.move(1, { x: -80, y: 0 }, bounds); gesture.move(2, { x: 80, y: 0 }, bounds);
    assert.equal(gesture.transform.scale, 2);
    assert.equal(gesture.up(first, { x: first === 1 ? -80 : 80, y: 0 }, bounds), undefined);
    const second = first === 1 ? 2 : 1;
    assert.equal(gesture.up(second, { x: second === 1 ? -80 : 80, y: 0 }, bounds), undefined);
  }
});
test("zoom limits and wide-image pan bounds keep the picture on screen", () => {
  const wide = { ...bounds, imageWidth: 390, imageHeight: 180 };
  assert.deepEqual(boundTransform({ scale: 4, x: 2000, y: 2000 }, wide), { scale: 4, x: 585, y: 0 });
  assert.deepEqual(boundTransform({ scale: .2, x: 90, y: 40 }, bounds), { scale: 1, x: 0, y: 0 });
  assert.equal(boundTransform({ scale: 20, x: 0, y: 0 }, bounds).scale, 4);
});
