/** 世界观短句：与数值解耦（见 docs/README.md） */

const EPIGRAPHS: string[] = [
  "万象阁录：灵石非石，心念所聚，涓滴成川。",
  "昼夜只是背景，修行自有节奏。",
  "同一灵卡，重复相遇，星纹自深，不必懊恼。",
  "五行在阵，三者同气，灵脉乃自然，非秘术。",
  "境界如阶，每上一层，凡俗灵息皆不同。",
  "轮回非败，一世沉淀作道韵，再开一局。",
  "图鉴过半，天地知你见过众生；全满者，万象记名。",
  "唤灵髓出幻域，聚灵阵唤引；共鸣随时间自涨，不假手速。",
  "灵石分流：破境、蕴灵、升阶。",
  "岁序随修行推进，不必对表苦等。",
];

export function epigraphForDaily(nowMs: number, inGameDay: number, hourIndex: number): string {
  const seed = Math.floor(nowMs / 120000) + inGameDay * 17 + hourIndex * 31;
  return EPIGRAPHS[((seed % EPIGRAPHS.length) + EPIGRAPHS.length) % EPIGRAPHS.length]!;
}
