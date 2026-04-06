/**
 * 面向玩家的说明文：收纳于「万象图鉴 → 修行札记」，避免主界面堆砌。
 */
import { REINCARNATION_REALM_REQ } from "../types";
import { UI_LORE_THREE_ARTS, UI_LORE_BOUNTY, UI_LORE_ESTATE } from "./visualAssets";

export function renderGameLoreHtml(): string {
  return `
    <div class="game-lore" id="game-lore">
      <h3 class="sub-h game-lore-title">修行札记</h3>
      <p class="hint sm game-lore-lead">下列为机制细则；日常游玩只需看各页顶部的短提示即可。</p>

      <details class="game-lore-block" open>
        <summary>术语速查（白话版）</summary>
        <ul class="game-lore-list">
          <li><strong>幻域</strong> = 副本；刷怪拿资源。</li>
          <li><strong>破境</strong> = 升级境界；提升基础强度并解锁功能。</li>
          <li><strong>轮回</strong> = 重开本轮；会重置部分进度，但保留永久向强化。</li>
          <li><strong>洞府</strong> = 永久成长线；投入后跨轮回保留。</li>
          <li><strong>灵卡</strong> = 卡牌；上阵后提供产出与战斗效果。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary>资源与灵石分流</summary>
        <ul class="game-lore-list">
          <li><strong>灵石</strong>：破境、洞府蕴灵、灵卡升阶等主要消耗。</li>
          <li><strong>唤灵髓</strong>：幻域产出为主，用于聚灵阵唤引与境界铸灵；不可用灵石直接购买。</li>
          <li><strong>灵砂 / 玄铁</strong>：分解灵卡 / 装备获得，用于升阶与强化。</li>
          <li>身法、装备与统计汇总在右下角<strong>角色</strong>面板。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary>洞府蕴灵四线</summary>
        <ul class="game-lore-list">
          <li><strong>汇灵</strong>：全局灵石效率乘区。</li>
          <li><strong>灵息</strong>：在汇灵等乘区之后，再叠一层灵石效率（约每级 +2.2%，与汇灵叠乘）。</li>
          <li><strong>固元</strong>：以道韵淬炼道基，降低破境灵石消耗。</li>
          <li><strong>共鸣</strong>：与「聚灵共鸣」进度、幻域唤灵髓结算共用同一乘区（与法篆、词条等叠乘，满级约 +32%）。</li>
          <li>洞府等级<strong>轮回不重置</strong>，可长期投入。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary>五行灵脉（同系≥3）</summary>
        <p class="hint sm">灵脉需<strong>同系灵卡≥3</strong>张上阵激活，与洞府并行。</p>
        <ul class="game-lore-list">
          <li><strong>焚天（火）</strong>：解锁「焚天」爆发，按阵中火灵与星辉缩短间隔、提高收益。</li>
          <li><strong>溯流（水）</strong>：水灵卡灵石贡献呈指数链叠乘，多水越强。</li>
          <li><strong>岁木（木）</strong>：木灵基础产出随修行时长（岁序）缓慢放大。</li>
          <li><strong>剑虹（金）</strong>：金属性灵卡总战力越高，唤引时额外灵石返利越多。</li>
          <li><strong>厚土（土）</strong>：提升离线可结算时长与离线灵石倍率。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary>聚灵共鸣</summary>
        <p class="hint sm">共鸣度随<strong>游戏时间</strong>自动涨（与当前页签无关），<strong>不可点击</strong>；满百得 <strong>唤灵髓 +1</strong>，无次数上限。<strong>在线、离线追赶、闭关预演</strong>均按同公式累积。法篆与洞府「共鸣」可略加快涨速（叠乘）。</p>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_THREE_ARTS}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 挂机修炼（三艺）</summary>
        <ul class="game-lore-list">
          <li>同一时间仅<strong>一条</strong>技能获得经验；在修炼页切换<strong>战艺 / 采灵 / 法篆</strong>。</li>
          <li><strong>战艺</strong>：影响幻域攻防、生命与相关节奏（详见「角色」心法与属性）。</li>
          <li><strong>采灵</strong>：略增灵石向收益。</li>
          <li><strong>法篆</strong>：略加快聚灵共鸣累积（与洞府「共鸣」叠乘）。</li>
          <li>三线等级均达到较高阶段时，功业录中另有对应嘉奖。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_BOUNTY}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 周常悬赏</summary>
        <ul class="game-lore-list">
          <li>按<strong>本地时区</strong>：每周一 <strong>0:00</strong> 刷新各条目进度与「已领」状态；与真实日历周对齐。</li>
          <li>条目覆盖幻域、唤引、铸灵、灵田、吐纳、破境等；达成后即可领<strong>灵石</strong>与<strong>唤灵髓</strong>。</li>
          <li>底部可<strong>一键领取</strong>所有已达成的条目。</li>
          <li>与「功业录」<strong>不同</strong>：功业录多为一次性或累计终身目标；周常按<strong>自然周</strong>循环。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_ESTATE}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 灵府与灵脉</summary>
        <ul class="game-lore-list">
          <li><strong>灵田</strong>：地块种植灵草，到时收获灵砂、灵石等；养成进度<strong>跨轮回保留</strong>。</li>
          <li><strong>纳灵阵图</strong>：消耗灵石与灵砂提升重数，增加全局灵石效率（与其它乘区叠乘）。</li>
          <li><strong>蓄灵池</strong>：随当前灵石产出缓慢蓄存，可一次性收取进背包；有上限，随境界与轮回略放大。</li>
          <li><strong>心斋卦象</strong>：按<strong>本地日历日</strong>刷新一条运势，影响灵石等乘区；跨日自动更替。</li>
          <li><strong>天机匣</strong>：每周轮换限购兑换，周次与<strong>周常悬赏</strong>同源（每周一本地 0:00）；用灵石 / 灵砂 / 玄铁 / 唤灵髓等按条目支付。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary>幻域副本</summary>
        <ul class="game-lore-list">
          <li>首通主要掉落<strong>唤灵髓</strong>；<strong>整关清完</strong>后统一入背包。复刷关会额外给灵砂。</li>
          <li><strong>幻域生命</strong>为全局状态，进关不会自动回满；接战恢复慢，游走较快。</li>
          <li>进入波次<strong>不消耗</strong>唤灵髓；阵亡<strong>不损失</strong>灵石，并被送至灵息之地；回满后可<strong>勾选自动进本</strong>或手动进入该关。每次进关<strong>重整阵势与满血敌阵</strong>。</li>
          <li>已通关波次可复刷（髓收益降低）。</li>
          <li><strong>阵线对决</strong>：敌我各按攻击间隔<strong>离散出伤 / 承击</strong>，顶条为敌阵总灵压；剑气 / 凶煞读条对齐期望 DPS 与敌方节奏，便于对照数值。</li>
          <li>五行克制会影响伤害；<strong>化劲</strong>可在无敌帧内化解敌方一击。</li>
          <li>魔物<strong>闪避</strong>以飘字「偏斜」表现；我方闪避以「闪避」表现。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary>功能解锁一览</summary>
        <ul class="game-lore-list">
          <li><strong>幻域</strong>：完成首次唤引。</li>
          <li><strong>修炼</strong>：幻域至少通关一波、或境界≥三重、或累计唤引≥六次。</li>
          <li><strong>背包装备 / 境界铸灵</strong>：获得第一件装备，或累计唤引≥十次。</li>
          <li><strong>洞府蕴灵</strong>：完成一次唤引，或境界≥二重。</li>
          <li><strong>万象图鉴</strong>：累计唤引≥5次，或境界≥四重。</li>
          <li><strong>轮回阁</strong>：境界≥十八重，或已完成轮回。</li>
          <li><strong>灵宠</strong>：幻域累计击溃 15 波。</li>
          <li><strong>封存/拓印</strong>（养成→轮回页底）：境界≥十二重或曾入轮回。</li>
          <li><strong>功业录</strong>：境界≥六重，或累计唤引≥15次。</li>
          <li><strong>十连</strong>：完成一次单抽，或境界≥三重。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary>卡组与轮回</summary>
        <ul class="game-lore-list">
          <li><strong>上阵</strong>：点空阵位再点仓库，或先点仓库再点阵位；点已有卡的阵位可选中该卡。升阶需灵砂。</li>
          <li>境界达到 <strong>${REINCARNATION_REALM_REQ}</strong> 后可轮回：清空境界、灵石、卡组与持有卡牌；保留图鉴邂逅、成就与元强化。道韵按本轮灵石巅峰等规则结算。</li>
        </ul>
      </details>
    </div>`;
}
