/**
 * Pure physics utility functions.
 * No state — fully testable.
 */
export class Physics {
  /**
   * Frame-rate independent velocity update.
   * @param velocity - current velocity (pixels/frame at 60fps)
   * @param gravity  - gravity constant
   * @param deltaMs  - elapsed time in milliseconds
   */
  static applyGravity(velocity: number, gravity: number, deltaMs: number): number {
    const dt = deltaMs / (1000 / 60);
    return velocity + gravity * dt;
  }

  /**
   * Returns the velocity immediately after a jump.
   * @param jumpStrength - negative value (upward)
   */
  static applyJump(jumpStrength = -9): number {
    return jumpStrength;
  }

  /**
   * Compute new y position.
   */
  static applyVelocity(y: number, velocity: number, deltaMs: number): number {
    const dt = deltaMs / (1000 / 60);
    return y + velocity * dt;
  }

  /**
   * Compute bird tilt rotation from velocity.
   * Returns degrees: negative = nose up, positive = nose down.
   */
  static computeRotation(velocity: number): number {
    return Math.min(90, Math.max(-30, velocity * 3));
  }
}