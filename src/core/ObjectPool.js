/**
 * @file ObjectPool.js
 * @description High-performance generic object pool to eliminate Garbage Collection pauses.
 * Pre-allocates objects and reuses them via O(1) stack operations.
 */

export class ObjectPool {
  /**
   * @param {Function} factory Function to create a new instance
   * @param {Function} reset Function to reset instance state before reuse
   * @param {number} [initialSize=50] Pre-allocation capacity
   * @param {number} [maxSize=500] Maximum pool capacity
   */
  constructor(factory, reset, initialSize = 50, maxSize = 500) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
    this.pool = [];

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Acquire an object from the pool
   * @returns {*}
   */
  acquire() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.factory();
    }
    obj.inPool = false;
    return obj;
  }

  /**
   * Release an object back into the pool
   * @param {*} obj
   */
  release(obj) {
    if (!obj || obj.inPool) return;
    if (this.reset) {
      this.reset(obj);
    }
    obj.inPool = true;
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  /**
   * Release multiple objects back into the pool
   * @param {Array<*>} objects
   */
  releaseAll(objects) {
    for (let i = 0; i < objects.length; i++) {
      this.release(objects[i]);
    }
    objects.length = 0;
  }

  /**
   * Current free objects in pool
   */
  get size() {
    return this.pool.length;
  }
}
