/**
 * 轻量趣味：不影响数值与存档，仅会话内状态。
 */

const FLAVOR_LINES = [
  "灵石不会背叛你，除非小数点背叛了浮点。",
  "今日宜挂机，忌焦虑对比欧皇。",
  "破境失败？宇宙只是在帮你多攒一点剧情。",
  "抽卡前先深呼吸——概率之神正在打盹。",
  "幻域里走位再秀，也秀不过现实里准点下班。",
  "共鸣满了别愣着，唤灵髓在等你签收。",
  "洞府强化一级，心里踏实一寸。",
  "轮回不是重置，是带着记忆换个姿势变强。",
  "装备满了？分解也是一种放生。",
  "焚天亮了记得截图，毕竟帅要留档。",
  "挂机越久，越像修仙；修仙越久，越像挂机。",
  "灵脉升级的声音，比闹钟温柔。",
  "今日道韵已满，建议摸鱼合法化。",
  "若觉无聊，说明你的自动化已经接管了人生。",
  "提示：本游戏不含内购，只含内卷。",
  "你点的不是抽卡，是薛定谔的惊喜。",
  "离线收益到账时，记得对世界说声谢谢。",
  "境界再高，也别忘记给手机充电。",
  "小怪只是路过，灵石才是正缘。",
  "据说连续点击标题小精灵会……你试试？",
];

let pickedFlavor: string | null = null;

export function sessionFunFlavorLine(): string {
  if (!pickedFlavor) {
    pickedFlavor = FLAVOR_LINES[Math.floor(Math.random() * FLAVOR_LINES.length)]!;
  }
  return pickedFlavor;
}

let spiritClicks = 0;

const SPIRIT_TOASTS: { at: number; msg: string }[] = [
  { at: 1, msg: "小精灵歪了歪头：有事？" },
  { at: 5, msg: "它开始认真怀疑你在摸鱼。" },
  { at: 12, msg: "灵息微动——大概是被你戳烦了。" },
  { at: 25, msg: "万象之灵：再戳我就要收费了（并没有）。" },
  { at: 42, msg: "生命、宇宙以及一切的答案……不是灵石，是 42。" },
  { at: 66, msg: "六六大顺！它决定假装没看见你在虐待图标。" },
  { at: 99, msg: "你赢了。它承认你是标题栏霸主。" },
];

/** 点击标题旁小精灵时调用；返回要弹的 toast 文案，或 null。 */
export function onTitleSpiritPet(): string | null {
  spiritClicks += 1;
  const hit = SPIRIT_TOASTS.find((t) => t.at === spiritClicks);
  return hit ? hit.msg : null;
}

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

let konamiIdx = 0;

function keyMatches(expected: string, key: string): boolean {
  if (expected === "ArrowUp" || expected === "ArrowDown" || expected === "ArrowLeft" || expected === "ArrowRight") {
    return key === expected;
  }
  return key.length === 1 && key.toLowerCase() === expected;
}

/**
 * 在 document 上监听一次；输入框聚焦时不触发进度。
 * 完成 Konami 序列时调用 onUnlock。
 */
export function bindKonamiEasterEgg(onUnlock: () => void): void {
  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      const expected = KONAMI[konamiIdx];
      if (expected === undefined) {
        konamiIdx = 0;
        return;
      }
      if (keyMatches(expected, e.key)) {
        konamiIdx += 1;
        if (konamiIdx >= KONAMI.length) {
          konamiIdx = 0;
          onUnlock();
        }
      } else {
        konamiIdx = keyMatches(KONAMI[0]!, e.key) ? 1 : 0;
      }
    },
    { passive: true },
  );
}
