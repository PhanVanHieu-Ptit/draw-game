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
   * Check circle collision with another entity
   * @param {Entity} other 
   * @returns {boolean}
   */
  collidesWith(other) {
    return this.distanceTo(other) < (this.radius + other.radius);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx) {
    // Override in subclass
  }
}
