# -*- coding: utf-8 -*-
"""One-off script to strip dungeon module wiring from src/main.ts."""
import re
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "src" / "main.ts"
s = path.read_text(encoding="utf-8")

s = re.sub(
    r"  BI_GUAN_COOLDOWN_MS,\n  TUNA_COOLDOWN_MS,\n  DUNGEON_DEATH_CD_MS,\n  DUNGEON_INTER_WAVE_CD_MS,\n  PLAYER_DUNGEON_HIT_INTERVAL_SEC,\n  DUNGEON_STAMINA_MAX,\n  DUNGEON_DODGE_STAMINA_COST,\n",
    "  BI_GUAN_COOLDOWN_MS,\n  TUNA_COOLDOWN_MS,\n  PLAYER_DUNGEON_HIT_INTERVAL_SEC,\n",
    s,
    count=1,
)

s = re.sub(
    r"import \{\n  formatDungeonActiveMeta,\n  renderDungeonPanel,\n  renderTrainPanel,\n  renderGearPanel,\n  renderPetPanel,\n\} from \"./ui/extraPanels\";",
    'import { renderTrainPanel, renderGearPanel, renderPetPanel } from "./ui/extraPanels";',
    s,
    count=1,
)

s = re.sub(
    r"  playerDungeonSustainedDamageMult,\n\} from \"./systems/playerCombat\";\nimport \{\n  enterDungeon,\n  leaveDungeon,\n  tryAutoEnterFromSanctuaryPortal,\n  canEnterDungeon,\n  canEnterAtWave,\n  dungeonFrontierWave,\n  dungeonEntryFeeEssence,\n  computeDungeonRepeatMode,\n  pickCombatTargetMob,\n  drainDungeonDamageFloats,\n  bossDisplayTitle,\n  currentBossMob,\n  playerEngageRadiusNorm,\n  playerAttackDiskOuterRadiusNormForUi,\n  queueDungeonDodge,\n  totalAliveMobHpSum,\n\} from \"./systems/dungeon\";\n",
    "  playerDungeonSustainedDamageMult,\n  playerEngageRadiusNorm,\n} from \"./systems/playerCombat\";\n",
    s,
    count=1,
)

s = re.sub(
    r"/\*\* 幻域本局用时 / 预计清怪剩余（秒 → 展示） \*/\nfunction fmtDungeonDur\(sec: number\): string \{.*?\n\}\n\n",
    "",
    s,
    count=1,
    flags=re.DOTALL,
)

s = s.replace(
    "/** 主导航：底部五栏（中间为幻域）+ 部分页内二级子栏 */\ntype HubId = \"character\" | \"cultivate\" | \"battle\" | \"gacha\" | \"estate\";",
    "/** 主导航：底部四栏 + 部分页内二级子栏 */\ntype HubId = \"character\" | \"cultivate\" | \"gacha\" | \"estate\";",
)
s = s.replace(
    "let autoEnterPromptHandled = false;\nlet veinHelpDocListenerBound = false;",
    "let veinHelpDocListenerBound = false;",
)
s = s.replace(
    "/** 主循环间隔：过小会增加 CPU，过大则幻域位移像「瞬移」跨格 */\nconst LOOP_INTERVAL_MS = 50;\n\nlet toastTimer = 0;\nlet flyCreditsDismissed = false;\nconst deferredDungeonToasts: string[] = [];\nlet lastDungeonActive = false;",
    "const LOOP_INTERVAL_MS = 50;\n\nlet toastTimer = 0;\nlet flyCreditsDismissed = false;\nconst deferredHiddenTabToasts: string[] = [];",
)
s = s.replace("deferredDungeonToasts.push(msg);", "deferredHiddenTabToasts.push(msg);")
s = s.replace("    battle: 22,\n", "")
s = re.sub(
    r"const DODGE_FAIL_TOAST_GAP_MS = 900;\nlet lastDodgeFailToastAt = 0;\nconst AUTO_ENTER_FAIL_TOAST_GAP_MS = 3000;\nlet lastAutoEnterFailToastAt = 0;\nlet lastAutoEnterFailReason = \"\";\n",
    "",
    s,
    count=1,
)

s = re.sub(
    r"function tryQueueDungeonDodgeWithFeedback\(\): void \{.*?\n\}\n\nfunction maybeToastAutoEnterFailure\(now: number\): void \{.*?\n\}\n\n/\*\* 顶栏货币",
    "/** 顶栏货币",
    s,
    count=1,
    flags=re.DOTALL,
)

s = s.replace(
    "    \"唤灵髓\\n\\n用于抽卡、进入幻域、抽取心法。主要由共鸣进度生成，也可由玩法和成就获得。不能用灵石直接购买。\",",
    "    \"唤灵髓\\n\\n用于抽卡、铸灵、领悟心法等。主要由共鸣进度生成，也可由玩法和成就获得。不能用灵石直接购买。\",",
)

# Remove sanctuary / auto-enter / float / pending / lastDungeon block in loop
s = re.sub(
    r"  if \(!mobileLiteFx\) updateModernVisualFx\(now\);\n  if \(typeof document !== \"undefined\" && tryAutoEnterFromSanctuaryPortal\(state, now\)\) \{.*?\n  lastDungeonActive = state\.dungeon\.active;\n",
    "  if (!mobileLiteFx) updateModernVisualFx(now);\n",
    s,
    count=1,
    flags=re.DOTALL,
)

# Remove big tabDungeon live-update block through foot timer
s = re.sub(
    r"  if \(getUiUnlocks\(state\)\.tabDungeon && state\.dungeon\.active\) \{.*?\n  if \(getUiUnlocks\(state\)\.tabDungeon && activeHub === \"battle\"\) \{.*?\n  \}\n  updateTopResourcePillsAndVigor\(pool\);",
    "  updateTopResourcePillsAndVigor(pool);",
    s,
    count=1,
    flags=re.DOTALL,
)

# stats: combat ref wave
s = re.sub(
    r"const refWave = state\.dungeon\.active \? state\.dungeon\.wave : Math\.max\(1, state\.dungeon\.maxWaveRecord\);",
    "const refWave = Math.max(1, state.combatReferenceWave);",
    s,
    count=1,
)

s = re.sub(
    r"    const rw = state\.dungeon\.active \? state\.dungeon\.wave : Math\.max\(1, state\.dungeon\.maxWaveRecord\);",
    "    const rw = Math.max(1, state.combatReferenceWave);",
    s,
    count=1,
)

# Remove dungeon stat rows from renderPlayerStatsBlock
s = re.sub(
    r"        <div class=\"ps-stat\"><span class=\"ps-stat-label\">幻域通关波次</span><strong id=\"ps-dungeon-waves\">\$\{st\.dungeon\.totalWavesCleared\}</strong></div>\n        <div class=\"ps-stat\"><span class=\"ps-stat-label\">最高推进波</span><strong id=\"ps-max-wave\">\$\{st\.dungeon\.maxWaveRecord\}</strong></div>\n",
    "",
    s,
    count=1,
)
s = s.replace(
    '<div class="ps-stat"><span class="ps-stat-label">幻域生命</span>',
    '<div class="ps-stat"><span class="ps-stat-label">战斗生命</span>',
)

# Combat panel copy
s = s.replace("身法与战斗属性", "身法与战斗属性")
s = s.replace(
    "      <p class=\"hint sm combat-stats-lead\">攻防血暴为全局属性；护体减免幻域受击，来源含装备、境界、战艺、洞府固元、卡组厚土/溯流、心法、灵宠等。</p>",
    "      <p class=\"hint sm combat-stats-lead\">攻防血暴为全局属性；护体影响受击参考乘区，来源含装备、境界、战艺、洞府固元、卡组厚土/溯流、心法、灵宠等。</p>",
)
s = s.replace(
    '        <div class="cs-cell"><span class="cs-label">幻域受击（参考）</span>',
    '        <div class="cs-cell"><span class="cs-label">受击参考（K/波次）</span>',
)
s = s.replace(
    '        <div class="cs-cell cs-cell-wide"><span class="cs-label">幻域闪避</span>',
    '        <div class="cs-cell cs-cell-wide"><span class="cs-label">闪避</span>',
)
s = s.replace(
    '        <div class="cs-cell cs-cell-wide"><span class="cs-label">幻域接战距离</span>',
    '        <div class="cs-cell cs-cell-wide"><span class="cs-label">接战距离</span>',
)
s = s.replace(
    '        <div class="cs-cell cs-cell-wide"><span class="cs-label">幻域攻击频率</span>',
    '        <div class="cs-cell cs-cell-wide"><span class="cs-label">攻击频率（期望）</span>',
)
s = s.replace(
    "? `<h3 class=\"sub-h\">灵宠（通关幻域≥15 波 · 唤灵池）</h3>",
    "? `<h3 class=\"sub-h\">灵宠（境界≥12 或唤引≥25 · 唤灵池）</h3>",
)
s = s.replace(
    '${psDng ? `<div class="cs-cell cs-cell-wide"><span class="cs-label">幻域攻加算（全局）</span>',
    '${psDng ? `<div class="cs-cell cs-cell-wide"><span class="cs-label">战斗攻加算（灵宠）</span>',
)

# unlock hints
s = re.sub(
    r"  if \(!u\.tabDungeon\) \{\n    unlockLines\.push\(\"「<strong>幻域</strong>」解锁条件：抽卡≥1，或境界≥2，或曾通关幻域。\"\);\n  \}\n  if \(!u\.tabTrain\) \{\n    unlockLines\.push\(\"「<strong>修炼</strong>」解锁条件：幻域通关 1 波，或境界≥3，或抽卡≥6。\"\);\n  \}",
    "  if (!u.tabTrain) {\n    unlockLines.push(\"「<strong>修炼</strong>」解锁条件：境界≥3，或抽卡≥6。\");\n  }",
    s,
    count=1,
)
s = re.sub(
    r"  if \(!u\.tabPets && u\.tabDungeon\) \{\n    unlockLines\.push\(\"「<strong>灵宠</strong>」解锁条件：幻域累计通关 15 波。\"\);\n  \}",
    "  if (!u.tabPets) {\n    unlockLines.push(\"「<strong>灵宠</strong>」解锁条件：境界≥12 或累计唤引≥25 次。\");\n  }",
    s,
    count=1,
)

# Tutorial step 3
s = s.replace(
    '    3: "引导：在抽卡页完成 1 次抽卡。完成后开放「幻域」。",',
    '    3: "引导：在抽卡页完成 1 次抽卡。",',
)

# normalizeHubNavigation
s = s.replace(
    "  if (activeHub === \"battle\" && !u.tabDungeon) activeHub = \"estate\";",
    "",
)

# renderFloatingSubNav comment
s = s.replace(
    "/** 二级页签：主内容区顶部横排（幻域已独立为底部「幻域」页） */",
    "/** 二级页签：主内容区顶部横排 */",
)

# discoverability battle branch
s = re.sub(
    r"  \} else if \(activeHub === \"battle\"\) \{\n    text = \"常用入口：这里就是副本（幻域）；进本与复刷都在此页。\";\n  \}",
    "",
    s,
    count=1,
)

# bottom nav
s = re.sub(
    r"\$\{item\(\"battle\", \"幻域·副本\", !u\.tabDungeon, false\)\}\n    ",
    "",
    s,
    count=1,
)

# renderHubContent battle case
s = re.sub(
    r"    case \"battle\":\n      return u\.tabDungeon\n        \? renderDungeonPanel\(state\)\n        : `<section class=\"panel\"><p class=\"hint\">完成 1 次抽卡后开放底部「<strong>幻域</strong>」。</p></section>`;\n",
    "",
    s,
    count=1,
)

s = s.replace(
    "      <p class=\"hint stone-uses\">灵石用于破境、洞府升级和升阶；唤灵髓用于抽卡和幻域。详细规则见「养成→图鉴·札记」。</p>",
    "      <p class=\"hint stone-uses\">灵石用于破境、洞府升级和升阶；唤灵髓用于抽卡、铸灵与心法等。详细规则见「养成→图鉴·札记」。</p>",
)

# ps-dungeon-waves update in loop - remove lines
s = re.sub(
    r"  const pDw = document\.getElementById\(\"ps-dungeon-waves\"\);\n  if \(pDw\) pDw\.textContent = String\(state\.dungeon\.totalWavesCleared\);\n  const pMw = document\.getElementById\(\"ps-max-wave\"\);\n  if \(pMw\) pMw\.textContent = String\(state\.dungeon\.maxWaveRecord\);\n",
    "",
    s,
    count=1,
)

# keydown space dodge
s = re.sub(
    r"  document\.addEventListener\(\n    \"keydown\",\n    \(e\) => \{.*?\n    \{ passive: false \},\n  \);\n",
    "",
    s,
    count=1,
    flags=re.DOTALL,
)

# visibility deferred
s = s.replace("deferredDungeonToasts", "deferredHiddenTabToasts")

path.write_text(s, encoding="utf-8")
print("patched", path)
