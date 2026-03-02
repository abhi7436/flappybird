// Game UI Layer — barrel export
export { initBackground, updateBackground, drawBackground } from './BackgroundRenderer';
export type { Star, Cloud, MidElement }                   from './BackgroundRenderer';
export { BirdRenderer, drawCrownAboveBird, drawBird, drawPipe } from './BirdSkins';
export { BIRD_SKINS, RARITY_CONFIG }                      from './BirdSkins';
export type { BirdAnimState }                             from './BirdSkins';
export { drawCoins, drawBugs, drawPoops, drawPowerUpIcon, drawWindArrows, drawFogOverlay } from './EntityRenderer';
export { buildHUDState }                                  from './HUDState';
export type { HUDState, BuildHUDStateParams }             from './HUDState';
export {
  createSweatDrop,
  tickSweatDrop,
  createFireParticle,
  tickFireParticle,
  tickParticles,
}                                                         from './ParticleSystem';
export type {
  Particle,
  SweatDrop,
  FireParticle,
}                                                         from './ParticleSystem';
