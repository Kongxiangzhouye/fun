/**
 * 面向玩家的说明文：收纳于「万象图鉴 → 修行札记」，避免主界面堆砌。
 */
import { REINCARNATION_REALM_REQ } from "../types";
import {
  UI_LORE_THREE_ARTS,
  UI_LORE_BOUNTY,
  UI_LORE_ESTATE,
  UI_LORE_UNLOCKS,
  UI_LORE_DUNGEON,
  UI_LORE_GEAR,
  UI_LORE_REINCARNATION,
  UI_LORE_GLOSSARY,
  UI_LORE_RESOURCES,
  UI_LORE_VEIN,
  UI_LORE_ELEMENTS,
  UI_LORE_PET,
  UI_LORE_META,
  UI_LORE_DAO_MERIDIAN,
  UI_LORE_BATTLE_SKILL,
  UI_LORE_LOGIN_CALENDAR,
  UI_LORE_CHRONICLE,
  UI_LORE_TUNA_MEDITATION,
  UI_RESONANCE_CORE,
} from "./visualAssets";

export function renderGameLoreHtml(): string {
  return `
    <div class="game-lore" id="game-lore">
      <h3 class="sub-h game-lore-title">修行札记</h3>
      <p class="hint sm game-lore-lead">下列为机制细则；日常游玩只需看各页顶部的短提示即可。</p>

      <details class="game-lore-block" open>
        <summary><img src="${UI_LORE_GLOSSARY}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 术语速查（白话版）</summary>
        <ul class="game-lore-list">
          <li><strong>幻域</strong> = 副本；刷怪拿资源。</li>
          <li><strong>破境</strong> = 升级境界；提升基础强度并解锁功能。</li>
          <li><strong>轮回</strong> = 重开本轮；会重置部分进度，但保留永久向强化。</li>
          <li><strong>洞府</strong> = 永久成长线；投入后跨轮回保留。</li>
          <li><strong>灵卡</strong> = 卡牌；上阵后提供产出与战斗效果。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_RESOURCES}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 资源与灵石分流</summary>
        <ul class="game-lore-list">
          <li><strong>灵石</strong>：破境、洞府蕴灵、灵卡升阶等主要消耗。</li>
          <li><strong>唤灵髓</strong>：幻域产出为主，用于聚灵阵唤引与境界铸灵；不可用灵石直接购买。</li>
          <li><strong>灵砂 / 玄铁</strong>：分解灵卡 / 装备获得，用于升阶与强化。</li>
          <li>身法、装备与统计汇总在右下角<strong>角色</strong>面板。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_VEIN}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 洞府蕴灵四线</summary>
        <ul class="game-lore-list">
          <li><strong>汇灵</strong>：全局灵石效率乘区。</li>
          <li><strong>灵息</strong>：在汇灵等乘区之后，再叠一层灵石效率（约每级 +2.2%，与汇灵叠乘）。</li>
          <li><strong>固元</strong>：以道韵淬炼道基，降低破境灵石消耗。</li>
          <li><strong>共鸣</strong>：与「聚灵共鸣」进度、幻域唤灵髓结算共用同一乘区（与法篆、词条等叠乘，满级约 +32%）。</li>
          <li>洞府等级<strong>轮回不重置</strong>，可长期投入。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_ELEMENTS}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 五行灵脉（同系≥3）</summary>
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
        <summary><img src="${UI_RESONANCE_CORE}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 聚灵共鸣</summary>
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
        <summary><img src="${UI_LORE_BATTLE_SKILL}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 心法（修炼）</summary>
        <ul class="game-lore-list">
          <li><strong>入口</strong>：修炼页「心法」子页（与<strong>幻域</strong>入口同条件解锁）。</li>
          <li>每次消耗 <strong>28</strong> 唤灵髓，随机<strong>领悟新心法</strong>或<strong>升级</strong>已有心法；单门最高 <strong>20</strong> 级，全部满级后无法继续抽取。</li>
          <li>不同心法可影响幻域攻防、灵石、唤灵髓发现、暴击等；细则见各心法文案，与装备、洞府等乘区<strong>叠乘或加算</strong>以面板为准。</li>
          <li><strong>轮回</strong>时心法等级与境界、卡组等一并<strong>清空</strong>（与图鉴、洞府、灵窍等永久项不同）。</li>
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
        <summary><img src="${UI_LORE_LOGIN_CALENDAR}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 灵息日历</summary>
        <ul class="game-lore-list">
          <li><strong>入口</strong>：养成→灵息日历（解锁条件见「功能解锁一览」）。</li>
          <li>按<strong>本地日历日</strong>：每日可<strong>领取一次</strong>奖励；跨日刷新领取资格与连签逻辑。</li>
          <li>若昨日已登录且今日继续登录，<strong>连签 +1</strong>；若中断则连签从 <strong>1</strong> 重新计数。</li>
          <li>奖励含灵石与唤灵髓，随连签数提高（具体数值见面板预览）。</li>
          <li>连签与领取记录<strong>不随轮回清空</strong>。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_CHRONICLE}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 唤灵通鉴</summary>
        <ul class="game-lore-list">
          <li><strong>入口</strong>：养成→唤灵通鉴。</li>
          <li>分「灵卡唤引」「铸灵」两张表，仅作记录展示，<strong>不消耗</strong>资源。</li>
          <li>各表最多保留最近 <strong>48</strong> 条；新记录挤掉最旧条目。</li>
          <li>灵卡表标注时间与稀有度，首次邂逅可标「首遇」。</li>
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
        <summary><img src="${UI_LORE_TUNA_MEDITATION}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 吐纳与闭关</summary>
        <ul class="game-lore-list">
          <li><strong>入口</strong>：养成→灵府→<strong>灵脉</strong>子页（吐纳与闭关按钮位于此）。</li>
          <li><strong>吐纳</strong>：冷却约 <strong>24</strong> 秒，就绪后点击获得灵石（数额随境界成长）；可造化玉解锁<strong>自动吐纳</strong>。计入周常「吐纳」条目。</li>
          <li><strong>闭关</strong>：境界≥<strong>六重</strong>后可见；瞬间按约 <strong>1 小时</strong>的挂机收益规则预演结算灵石（与离线同乘区，仍受离线时长上限等约束）。</li>
          <li>闭关有独立冷却（约 <strong>70</strong> 秒），预演同样会推进聚灵共鸣等随时间累积的系统。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_DUNGEON}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 幻域副本</summary>
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
        <summary><img src="${UI_LORE_PET}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 唤灵池与灵宠</summary>
        <ul class="game-lore-list">
          <li>养成页<strong>灵宠</strong>：幻域累计击溃 <strong>15</strong> 波后开放唤灵池。</li>
          <li><strong>唤灵</strong>：每次消耗 <strong>42</strong> 唤灵髓邂逅一只灵宠；稀有度按池内权重随机。</li>
          <li><strong>重复邂逅</strong>：已获得同名灵宠时，转化为灵契经验并可能直接升级。</li>
          <li><strong>喂养</strong>：对已邂逅灵宠消耗唤灵髓获得经验，提升等级以放大加成（上限见面板）。</li>
          <li>灵宠效果多为灵石、幻域攻防或唤灵髓发现等；邂逅与等级<strong>跨轮回保留</strong>。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_GEAR}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 行囊与铸灵</summary>
        <ul class="game-lore-list">
          <li><strong>行囊</strong>：武器 / 衣甲 / 戒指三槽可装备；可<strong>锁定</strong>以防分解与自动分解误吞。</li>
          <li><strong>铸灵池</strong>：消耗<strong>唤灵髓</strong>铸灵，随机基底与稀有度；连续未出珍品以上会累积珍品保底计数。</li>
          <li><strong>强化 / 精炼</strong>：消耗<strong>玄铁</strong>提升强化等级；UR 可继续精炼（细则见背包页）。</li>
          <li><strong>分解</strong>：多余装备可分解为玄铁；可在行囊内勾选自动分解的品阶。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_UNLOCKS}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 功能解锁一览</summary>
        <p class="hint sm">下列条件与界面逻辑一致；满足<strong>任一</strong>即可（文中「或」为并列条件）。</p>
        <ul class="game-lore-list">
          <li><strong>幻域</strong>：累计唤引≥1、或境界≥二重、或幻域累计击溃≥1 波（欢迎引导未完成时可能暂不可见）。</li>
          <li><strong>修炼</strong>：幻域至少通关一波、或境界≥三重、或累计唤引≥六次。</li>
          <li><strong>心法</strong>（修炼页）：与<strong>幻域</strong>入口同条件。</li>
          <li><strong>背包装备 / 境界铸灵</strong>：获得第一件装备，或累计唤引≥十次。</li>
          <li><strong>洞府蕴灵</strong>：完成一次唤引，或境界≥二重。</li>
          <li><strong>万象图鉴</strong>：累计唤引≥5次，或境界≥四重。</li>
          <li><strong>唤灵通鉴</strong>：累计唤引≥1次。</li>
          <li><strong>灵息日历</strong>：累计唤引≥1次，或境界≥二重。</li>
          <li><strong>轮回阁</strong>：境界≥十八重，或已完成轮回。</li>
          <li><strong>灵宠</strong>：幻域累计击溃 15 波。</li>
          <li><strong>封存/拓印</strong>（养成→轮回页底）：境界≥十二重或曾入轮回。</li>
          <li><strong>功业录</strong>：境界≥六重，或累计唤引≥15次。</li>
          <li><strong>周常悬赏</strong>：境界≥五重，或累计唤引≥5次。</li>
          <li><strong>灵府·灵田</strong>：累计唤引≥1次且境界≥四重。</li>
          <li><strong>纳灵阵图</strong>：境界≥五重且累计唤引≥2次。</li>
          <li><strong>蓄灵池</strong>：境界≥三重，或累计唤引≥3次。</li>
          <li><strong>心斋卦象</strong>：境界≥四重，或累计唤引≥5次。</li>
          <li><strong>天机匣</strong>：境界≥五重，或累计唤引≥6次。</li>
          <li><strong>道韵灵窍</strong>：已完成轮回、或道韵≥15、或已领悟过道窍（等级&gt;0）。</li>
          <li><strong>十连</strong>：完成一次单抽，或境界≥三重。</li>
          <li><strong>聚灵共鸣进度条</strong>：累计唤引≥2次。</li>
          <li><strong>概率公示</strong>：累计唤引≥4次。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_REINCARNATION}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 卡组与轮回</summary>
        <ul class="game-lore-list">
          <li><strong>上阵</strong>：点空阵位再点仓库，或先点仓库再点阵位；点已有卡的阵位可选中该卡。升阶需灵砂。</li>
          <li>境界达到 <strong>${REINCARNATION_REALM_REQ}</strong> 后可轮回：清空境界、灵石、卡组与持有卡牌；保留图鉴邂逅、成就与元强化。道韵按本轮灵石巅峰等规则结算。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_META}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 元强化与道韵</summary>
        <ul class="game-lore-list">
          <li><strong>轮回阁</strong>（养成→轮回）：境界≥<strong>十八重</strong>或已完成过轮回后，可见<strong>元强化</strong>与轮回说明。</li>
          <li><strong>道韵</strong>：每次轮回结算获得，用于购买元强化；<strong>跨轮回保留</strong>。</li>
          <li><strong>灵脉共鸣</strong>：每级全局挂机效率 +8%。</li>
          <li><strong>祈愿加护</strong>：每级略提高唤引高稀有权重。</li>
          <li><strong>额外槽位</strong>：每级卡组 +1 阵位，最多强化 2 级（总槽位上限 6）。</li>
          <li><strong>轮回赠髓</strong>：每级提高轮回后的初始唤灵髓。</li>
          <li><strong>灵石心印</strong>：每级灵石获取 +6%。</li>
          <li>除「额外槽位」外，各条目最高可升至 <strong>20</strong> 级；花费道韵随等级递增。</li>
          <li><strong>造化玉</strong>：与道韵不同，用于「角色」等处解锁便利功能（如十连、自动抽卡等），多来自成就等。</li>
        </ul>
      </details>

      <details class="game-lore-block">
        <summary><img src="${UI_LORE_DAO_MERIDIAN}" alt="" width="20" height="20" class="game-lore-summary-icon" loading="lazy" /> 道韵灵窍</summary>
        <ul class="game-lore-list">
          <li><strong>入口</strong>：「角色」→ 道韵灵窍（解锁后可见）。解锁条件与「功能解锁一览」中<strong>道韵灵窍</strong>条目一致。</li>
          <li>共 <strong>5</strong> 重，依次消耗道韵点亮；下一重花费为 <strong>18 / 36 / 54 / 72 / 96</strong>（已满则不再显示）。</li>
          <li><strong>汇灵窍</strong>：灵石挂机收益提升。</li>
          <li><strong>淬髓窍</strong>：幻域唤灵髓收益提升。</li>
          <li><strong>缘法窍</strong>：唤引时高稀有倾向微量提升。</li>
          <li><strong>固本窍</strong>：生命上限提升。</li>
          <li><strong>战意窍</strong>：幻域内攻击提升。</li>
          <li>各重效果与面板数值一致，并与其它乘区<strong>叠乘</strong>；灵窍进度<strong>跨轮回保留</strong>。</li>
        </ul>
      </details>
    </div>`;
}
