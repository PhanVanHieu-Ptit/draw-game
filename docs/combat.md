# Combat refactor

The existing rune-queue damage model, boss phases, tactical rune requirements, heart healing, secret phrases, upgrades, companions and event multipliers remain the default. The five new mechanics are opt-in and independent. No save schema changes are needed; combat configuration belongs to the application, not a saved run.

## Incremental changes

1. Recognition remains in InputHandler/GestureEngine. `Game.onGestureRecognized` routes practice input or hands a recognition result to `executeSpell`. Drawing and accessible synthetic input share execution. Casts during resume countdown or upgrade selection are ignored.
2. `src/combat/CombatSystem.js` owns cast identity, the hit ledger, damage rules, score arithmetic and synchronous ordered events. Projectiles carry cast identity and target generation. Reused pooled enemies cannot receive an old projectile's damage. Each cast can hit multiple enemies, but only once per enemy lifetime unless `damage.allowRepeat` is enabled. Extra damage consumes only consecutive matching runes and stops at boss phase boundaries.
3. Combo arithmetic is pure and tested. Existing tiers and upgrade extensions remain. The meter appears on the first hit; its last quarter changes color and triggers one text/audio warning per entry into the warning window. Percent quantization avoids redundant DOM writes.
4. `StatusEffects` provides refresh-by-longest-duration, custom definitions, multiplicative movement modifiers, expiry and clear-on-pool-reuse. Existing freeze/thaw, flinch and retreat state machines retain their timing and visuals. New stun/slow effects compose with these systems.
5. Feature flags enable Perfect Cast, Chain Reaction, elemental reactions, loadouts and elite modifiers. Existing feedback remains; new events have one-shot floating labels and existing audio cues.

## Configuration

Pass optional rules as the second argument to `new Game(canvas, rules)`. Defaults are exported as `COMBAT_DEFAULTS`; per-system rule groups merge with defaults. Use `game.combat.rules` for deliberate runtime changes between casts.

```js
const game = new Game(canvas, {
  flags: {
    perfectCast: true,
    chainReaction: true,
    elementalInteraction: true,
    spellLoadout: true,
    eliteModifiers: true
  },
  perfect: { minScore: 0.94, maxDuration: 1.2, scoreMultiplier: 1.5 },
  damage: { runes: 1, player: 1, allowRepeat: false },
  scoring: { multiplier: 1, chainBonus: 25 },
  loadout: ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning', 'heart', 'circle', 'spiral']
});
```

- **Perfect Cast:** recognized score and raw timestamp duration must both meet inclusive thresholds. Missing timing and synthetic inputs cannot qualify. The bonus applies to the successful cast's base rune score, before upgrades and event multipliers; it does not change rune damage or kill rewards.
- **Chain Reaction:** each distinct target actually hit after the first grants a configurable score bonus through the normal score path. This intentionally rewards multi-target hits without introducing extra damage or bypassing rune matching.
- **Elemental Interaction:** the default mapping is lightning→lightning, circle→ice, spiral→wind. Lightning hitting a frozen/ice-marked enemy applies a 0.6-second stun after a valid rune hit. Add entries to `elements` and `interactions` to extend this. The elemental mark lasts for the enemy's lifetime; status duration remains temporary. Reactions never consume an unmatched rune.
- **Spell Loadout:** only listed direct runes can execute. Secret combination effects bypass direct loadout checks. Existing support spells and phrases stay available with the flag off. There is no new loadout selection screen.
- **Elite modifiers:** spawn configs can provide `eliteModifier: 'armored'` (blocks one impact) or `'swift'` (20% movement boost). Add modifier definitions to `elite`. Game forwards modifiers from WaveSystem spawn configs; it does not randomly turn existing waves into elites. Bosses are only modified when explicitly configured. Spawning an elite announces its modifier.

Damage amounts must be finite nonnegative integers. Rule values, thresholds and event listeners are developer configuration, not untrusted player input. Existing modes use the same combat path; practice retains its own recognition-only behavior. Enabling a restricted loadout requires including the runes needed by the chosen mode.

## Event lifecycle

Subscribe using `game.combat.onEvent(listener)`; the returned function unsubscribes. Events contain a monotonically increasing `sequence`, `type` and relevant payload. Events are delivered synchronously in registration order. Listeners should observe results and trigger feedback, not recursively execute casts or mutate entity state. No unbounded event history is retained.

- Accepted cast: `cast:started`, existing cast/support/combo/score effects, `cast:launched`, then `cast:completed` when its last projectile resolves. Casts without projectiles complete immediately. A run reset discards in-flight casts with the project's existing projectile reset behavior.
- Impact: `hit:before` → `hit:blocked`, or optional `element:reaction` → `hit:resolved` → optional `chain:reaction`. Duplicate, stale and dead-target attempts do nothing. Unmatched entity hits emit `hit:before` but no resolved event.
- Secret Blade Storm uses a separate internal cast and emits started/impact/completed events; other phrases emit `phrase:executed` and keep their established effects and cooldowns.
- Other events: `player:damaged`, `player:blocked`, `player:healed`, `player:protected`, `support:freeze`, `combo:advanced`, `combo:expired`, `score:awarded`, `cast:perfect`.

Existing score/combo timing stays at cast launch for compatibility; actual impact events drive Chain Reaction and elemental status. Perfect Cast presentation occurs only for casts with matching targets.

## Simulation and performance

Combat calculations use explicit state and simulation deltas, with no combat RNG. Cosmetic particles can still use randomness. Pause and resume countdown do not advance `updatePlaying`, so invulnerability, statuses, combo, phrases and delayed fizzle audio remain frozen. Replaced combat fizzle `setTimeout` calls with a simulation-time delay; rapid misses coalesce that pending sound. Existing event/phrase systems continue to tick in simulation time.

No additional render pass, per-frame event history or per-enemy DOM nodes were added. Status effects are stored on pooled entities and cleared at initialization. Hit ledgers are weak maps owned by casts and become collectible when their projectiles are released.

## Validation

`npm run test:combat` covers rune damage, explicit repeats, multi-target hits, stale pooled targets, scoring, combo tiers/expiry, Perfect Cast boundaries and synthetic exclusion, status refresh/stack/expiry, invulnerability, elite armor, loadouts and independent flag defaults. `npm test` also exercises the existing gesture, support, boss, meta, mode, performance and engagement regressions. Two older partial Game harnesses now initialize the combat system, and the HUD mock supports its accessibility label.

`npm run build` rebuilds the distributable standalone HTML through the existing export script. Browser/audio perception still merits a manual playthrough before enabling experimental flags for players.
