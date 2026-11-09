export type Ability = {
  kind: string;
  cooldown: number;
  duration: number;
  warning: string;
};
export type EnemyDefinition = {
  id: string;
  name: string;
  category: string;
  archetype: string;
  health: number;
  speed: number;
  damage: number;
  score: number;
  gestures: string[];
  spawnProbability: number;
  abilities: Ability[];
  statusEffects: { kind: string; duration: number; strength: number }[];
  visual: string;
  audio: string;
};
export type BossDefinition = EnemyDefinition & {
  phases: {
    id: string;
    hpThreshold: number;
    transition: string;
    abilities: Ability[];
    gestures: string[];
    gestureRule: string;
    summons: string[];
    animation: string;
    warning: string;
  }[];
  defeatCondition: string;
};
export type WaveDefinition = {
  id: string;
  name: string;
  start: number;
  duration: number;
  groups: {
    enemyId: string;
    count: number;
    offset: number;
    interval: number;
    direction: string;
  }[];
  bossId: string;
  difficulty: { speedMultiplier: number; healthMultiplier: number };
};
export type Content = {
  enemies: EnemyDefinition[];
  bosses: BossDefinition[];
  waves: WaveDefinition[];
};
