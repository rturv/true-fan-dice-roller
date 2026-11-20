import { describe, expect, it } from 'vitest';
import { buildDiceParticles } from './dice-particles';

const fixedRandom = () => 0.5;

describe('buildDiceParticles', () => {
  it('builds the requested number of rain particles', () => {
    const particles = buildDiceParticles('rain', 30, fixedRandom);

    expect(particles).toHaveLength(30);
    for (const particle of particles) {
      expect(particle.value).toBeGreaterThanOrEqual(1);
      expect(particle.value).toBeLessThanOrEqual(6);
      expect(particle.left).toBeGreaterThanOrEqual(2);
      expect(particle.left).toBeLessThanOrEqual(96);
      expect(particle.size).toBeGreaterThanOrEqual(38);
      expect(particle.size).toBeLessThanOrEqual(54);
      expect(particle.delay).toBeGreaterThanOrEqual(0);
      expect(particle.delay).toBeLessThanOrEqual(1400);
      expect(particle.duration).toBeGreaterThanOrEqual(1400);
      expect(particle.duration).toBeLessThanOrEqual(2300);
      expect(particle.spin).toBeGreaterThanOrEqual(540);
      expect(particle.spin).toBeLessThanOrEqual(900);
      expect(particle.bounce).toBe(0);
    }
  });

  it('builds the requested number of avalanche particles', () => {
    const particles = buildDiceParticles('avalanche', 12, fixedRandom);

    expect(particles).toHaveLength(12);
    for (const particle of particles) {
      expect(particle.value).toBeGreaterThanOrEqual(1);
      expect(particle.value).toBeLessThanOrEqual(6);
      expect(particle.left).toBe(0);
      expect(particle.top).toBeGreaterThanOrEqual(20);
      expect(particle.top).toBeLessThanOrEqual(88);
      expect(particle.size).toBeGreaterThanOrEqual(24);
      expect(particle.size).toBeLessThanOrEqual(38);
      expect(particle.delay).toBeGreaterThanOrEqual(0);
      expect(particle.delay).toBeLessThanOrEqual(440);
      expect(particle.duration).toBeGreaterThanOrEqual(1200);
      expect(particle.duration).toBeLessThanOrEqual(1800);
      expect(particle.spin).toBeGreaterThanOrEqual(540);
      expect(particle.spin).toBeLessThanOrEqual(1080);
      expect(particle.spinMid).toBe(Math.round(particle.spin * 0.55));
      expect(particle.bounce).toBeGreaterThanOrEqual(-14);
      expect(particle.bounce).toBeLessThanOrEqual(14);
    }
  });

  it('never returns an empty list', () => {
    expect(buildDiceParticles('rain', 0, fixedRandom)).toHaveLength(1);
    expect(buildDiceParticles('avalanche', -3, fixedRandom)).toHaveLength(1);
  });
});
