/**
 * @file Entity.js
 * @description Base class for game entities with position, velocity, and lifecycle.
 */

export class Entity {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 20;
    this.isDead = false;
  }

  /**
   * Distance to another entity or point
   * @param {{x: number, y: number}} target 
   * @returns {number}
   */
  distanceTo(target) {
    return Math.hypot(target.x - this.x, target.y - this.y);
  }

  /**
   * Check circle collision with another entity with fast AABB rejection
   * @param {Entity} other 
   * @returns {boolean}
   */
  collidesWith(other) {
    if (!other) return false;
    const r = this.radius + (other.radius || 0);
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    if (Math.abs(dx) > r || Math.abs(dy) > r) return false;
    return (dx * dx + dy * dy) < (r * r);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx) {
    // Override in subclass
  }
}
