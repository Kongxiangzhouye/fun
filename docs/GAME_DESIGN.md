# 《万象唤灵》设计与实现说明（与代码同步）

本文档描述当前仓库**已实现**的行为与关键常量，便于策划、程序与后续迭代对齐。

---

## 1. 定位与体验

- **纯单机**：无服务端，规则完全本地执行。
- **核心循环**：挂机产**灵石** → 破境与养成 → **唤灵髓**抽灵卡/铸装备/幻域刷髓 → 构筑五行灵脉 → 境界 25 后可**轮回**积累**道韵**与长期成长。
- **大数**：灵石、峰值灵石等使用 `Decimal` 字符串存档，避免后期溢出。

---

## 2. 核心资源

| 资源 | 字段 | 轮回重置 | 主要来源 | 主要消耗 |
|------|------|----------|----------|----------|
| 灵石 | `spiritStones` | 是 | 挂机、焚天、余泽抽卡返利、吐纳等 | 破境、卡牌升级 |
| 唤灵髓 | `summonEssence` | 是（轮回后给少量起始值） | **幻域**、**聚灵共鸣**（随时间累积，含离线/闭关预演） | 聚灵阵/铸灵池抽卡、心法池、灵宠池 |
| 灵砂 | `lingSha` | 是 | 分解灵卡 | 卡牌升级 |
| 玄铁 | `xuanTie` | 是 | 分解装备 | 装备强化 |
| 道韵 | `daoEssence` | 否 | 轮回结算 | 轮回阁元升级 |
| 造化玉 | `zaoHuaYu` | 否 | 成就等 | QoL 特权解锁 |

**说明**：旧字段名 `tickets` 仍可能与唤灵髓迁移兼容并存，逻辑上以 `summonEssence` 为准。

---

## 3. 抽卡与经济参数（聚灵阵 / 铸灵池）

- **聚灵阵（灵卡）**：单抽 `12` 唤灵髓，十连 `110`（略优惠）。`meta.gachaLuck` 会抬高高稀有权重；**UR 硬保底**约 `90` 抽必出（`pityUr`）；**SSR+ 软保底**从约第 `65` 抽起逐渐抬高 SSR/UR 权重（`pitySsrSoft`）。
- **铸灵池（装备）**：单抽 `16`、十连 `145`，仅产出装备，**不占**灵卡 UR/SSR 保底计数。背包装备有上限（如 `80` 件）。
- **重复卡**：升星（上限 5 星）；图鉴用 `codexUnlocked` 记录。

---

## 4. 挂机收入与养成乘区（摘要）

收入核心在 `economy.incomePerSecond`，大致包含：

- 境界基础曲线、卡组**灵石产出**（含五行与水系链式计算，见下节）、卡组**境界加成百分比**、图鉴收集加成（上限约 15%）、元升级（idle / stone 等）、轮回次数加成、**洞府蕴灵**（汇灵/固元/灵犀/共鸣）、**采集等技能**对灵石的加成、**心法**对灵石的加成、**灵宠**对灵石乘区等。

**卡牌**：等级消耗灵石 + 灵砂；星级影响属性。卡组有效槽位：`min(6, 4 + meta.deckSlots)`。

**洞府蕴灵**（`vein`，轮回不重置）：汇灵、固元、灵犀、聚灵共鸣（加快共鸣点累积速度）。

---

## 5. 五行灵脉（同系 ≥3 张上阵）

实现于 `deckSynergy.ts`，界面摘要见 `deckSynergySummary`。

| 流派 | 条件 | 效果概要 |
|------|------|----------|
| 火 | 火 ≥3 | **焚天**：主动爆发灵石（`fenTian.ts`），CD 与等价挂机小时数随火系数量/星级变化 |
| 水 | 水 ≥3 | **溯流**：按上阵顺序水系卡**链式**放大产量（后一张基于前一张的幂次放大） |
| 木 | 木 ≥3 | **岁木**：木系产出随「修行岁序」缩放（`woodAdventureDays` 等） |
| 金 | 金 ≥3 | **剑虹**：每次抽卡额外获得灵石，与金属性卡有效产出之和挂钩 |
| 土 | 土 ≥3 | **厚土**：离线时间上限倍率（×2）与离线灵石倍率（×1.45） |

---

## 6. 游戏内时间与聚灵共鸣

- **内部刻度**：`inGameHour`（0–11）、`inGameDay`；每现实 `GAME_HOUR_REAL_SEC`（默认 **36** 秒）推进一格。界面不强调「十二时辰」文案。
- **灵息/挂机波动**：当前 `lingXiActiveFactor` / `idleLingXiFactor` 恒为 1（无昼夜大幅波动）。
- **聚灵共鸣**：`applyTick`、**离线追赶**（`catchUpOffline`）、**闭关快进**（`fastForward`）均按 `wishResonancePointsPerSecond` 对同一 `dt` 累积共鸣点，速率受秘法、洞府共鸣等影响；**满 100 点 +1 唤灵髓**，无每日上限。

---

## 7. 唤引余泽

每次唤引（抽灵卡）会推进 `pullsThisLife`；**本轮前 12 次**内每次有额外灵石奖励（与余泽公式相关，见 `dailyRewards.onGachaPulls`）。解锁「天道酬勤」后，十连有额外灵石奖励。

---

## 8. 幻域（副本）

- **唤灵髓主产地**；波次制、网格地图、移动与接战、群怪/首领、元素相克（`elementCombat` 等）。
- **魔物生命**：`monsterMaxHpForWave(w)` 为本波**总生命池**（含倍率 `MONSTER_HP_POOL_MULT`）；非首领波再按 `packSizeForWave` 只数平分（`hpSlice`），故 UI 上「单只血量」往往只有几十，而**总池**才是难度主尺度。首领波为单只，血量为总池 × 约 `4.2`。
- **玩家输出**：持续伤害；有效倍率 = 幻域攻速乘区 ÷ `PLAYER_DUNGEON_HIT_INTERVAL_SEC`（默认 **1.5s** 基准间隔，见 `playerDungeonSustainedDamageMult`）。
- **定身**：`playerMoveLockUntil` — 攻击动画每完成一周（且本次结算命中）或受到怪物伤害后，短暂不可移动/闪避（`DUNGEON_PLAYER_ATTACK_ROOT_MS` / `DUNGEON_HITSTUN_ROOT_MS`）。
- **阵亡**：真实时间冷却 `DUNGEON_DEATH_CD_MS`（75s）；**波次间隔休整** `DUNGEON_INTER_WAVE_CD_MS`（4s）。
- **进度**：未通关波次可存 `waveCheckpoint`，反复挑战保留血量与地图。
- **解锁**：教程与进度_gate 控制（见 `uiUnlocks`）；**灵宠**页签需幻域累计通关 **≥15 波**。

---

## 9. 装备（铸灵 / 强化 / 精炼）

- **部位**：武器、衣甲、戒指；**稀有度** N～UR；**词缀**含攻击、生命、暴击、全抗、噬髓（唤灵髓发现）等。
- **强化**：`enhanceLevel`；**UR 精炼** `refineLevel`（消耗同类规则见 `gearCraft`）。
- **装备**：三槽 `equippedGear`，影响战斗属性与幻域表现。

---

## 10. 灵宠

- **解锁**：`dungeon.totalWavesCleared >= 15`。
- **唤灵池**：消耗唤灵髓（`PET_PULL_COST` 等常量见 `systems/pets.ts`），按稀有度出宠；**已结缘灵宠全局叠加**，重复邂逅加灵契经验。
- **数据**：`pets`、`petPullsTotal`；具体加成见 `data/pets.ts` 与 `systems/pets.ts`。

---

## 11. 心法（战斗技能池）

- 消耗唤灵髓随机领悟/升级（单次消耗见 `battleSkillPullCost()`）。
- 提供幻域攻击、灵石产出、唤灵髓加成、暴击等（`systems/battleSkills.ts` + `data/battleSkills.ts`）。

---

## 12. 技能修炼（Melvor 式）

- **技能**：`combat` / `gathering` / `arcana`，挂机获得经验；`activeSkillId` 决定当前修炼哪一项。
- 影响共鸣、收入、战斗等（见 `skillTraining.ts` 与各引用处）。

---

## 13. 吐纳与闭关

- **吐纳**：主动小额灵石，`TUNA_COOLDOWN_MS`；可造化玉解锁自动吐纳。
- **闭关快进**：`fastForward` 按**离线规则**瞬间结算灵石（不超离线上限），用于合法跳时；**闭关按钮**另有 `BI_GUAN_COOLDOWN_MS` 防连点。

---

## 14. 轮回与轮回阁

- **条件**：境界 ≥ `REINCARNATION_REALM_REQ`（25）。
- **道韵**：与本轮峰值灵石等对数相关，另有卡牌收集加成（`daoEssenceGainOnReincarnate`）。
- **重置**：灵石、卡组、装备、幻域进度、部分货币与养成清空；**洞府蕴灵、图鉴解锁、灵宠、成就、道韵、造化玉、元升级**等按代码保留或部分保留（以 `performReincarnate` 为准）。
- **轮回后**：重新播种 RNG（防 S/L 与轮次一致）。

---

## 15. 造化玉 QoL

`qoL.ts` 消耗造化玉解锁，例如：

- 天道酬勤：一键十连相关体验  
- 袖里乾坤：一键升满卡牌等级（在灵石与灵砂允许范围内）  
- 万法自然：自动破境  
- 心血来潮：自动抽卡（有节流）  
- 吐纳自成：冷却就绪自动吐纳  

具体消耗为 `COSTS` 常量。

---

## 16. 飞升（真结局）

- **条件**（`trueEnding.ts`）：**图鉴全收集且境界 ≥ `TRUE_ENDING_REALM`（50）**，或灵石达到 `TRUE_ENDING_STONE_THRESHOLD`（`1e1000`）。
- **效果**：标记 `trueEndingSeen`，并发放造化玉等（见 `checkTrueEnding`）。

---

## 17. 界面解锁节奏

由 `getUiUnlocks(state)` 按境界、抽数、装备、幻域波次等推导，**无单独存档字段**。用于控制顶栏页签、十连解锁、统计项显示等。

---

## 18. 单机公平性

- **固定种子 RNG**：`rng.ts` + `seedrandom`，抽卡/掉落序列由种子与已保存状态决定，**读档无法改「下一次」结果**。
- **时间回拨**：`now < lastTick` 时跳过本次收益同步，不恶意扣资源（`applyTick` / `catchUpOffline`）。
- **离线上限**：基础 `MAX_OFFLINE_SEC_BASE`（72h 量级），土系灵脉可抬高 cap。

---

## 19. 存档

- **键名**：`idle-gacha-realm-v1`（`storage.ts`）。
- **版本**：`SAVE_VERSION`（`state.ts`，当前迭代为 **18**），含历史迁移逻辑。

---

## 20. 源码索引（按主题）

| 主题 | 主要文件 |
|------|----------|
| 入口 UI | `main.ts`、`styles.css`、`ui/*` |
| 状态与常量 | `types.ts`、`state.ts` |
| 存档 | `storage.ts` |
| 主循环 | `gameLoop.ts` |
| 经济 | `economy.ts`、`stones.ts` |
| 抽卡 | `gacha.ts` |
| 灵脉 / 焚天 | `deckSynergy.ts`、`fenTian.ts` |
| 游戏内时间 | `inGameClock.ts` |
| 共鸣与余泽 | `dailyRewards.ts` |
| 轮回 | `systems/reincarnation.ts` |
| 洞府 | `systems/veinCultivation.ts` |
| 幻域 | `systems/dungeon.ts`、`dungeonMap.ts` |
| 战斗属性 | `systems/playerCombat.ts`、`combatHp.ts`、`elementCombat.ts` |
| 装备 | `systems/gearCraft.ts`、`data/gearBases.ts` |
| 分解 | `systems/salvage.ts` |
| 灵宠 | `systems/pets.ts`、`petGacha.ts`、`data/pets.ts` |
| 心法 | `systems/battleSkills.ts`、`data/battleSkills.ts` |
| 技能修炼 | `systems/skillTraining.ts` |
| 吐纳 | `systems/tuna.ts` |
| 成就 | `achievements.ts` |
| 飞升 | `trueEnding.ts` |
| 卡牌数据 | `data/cards.ts` |
| 世界观短句 | `data/worldLore.ts`（与数值解耦） |

---

## 21. 已知与旧版文档差异

旧版设计案中部分设想（如多存档槽、沙盒创世面板、闭关令道具独立物品化、部分五行极端公式）**未实现或与当前公式不一致**者，以本文与源码为准。
