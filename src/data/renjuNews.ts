import type { NewsArticle } from '@/types/news';

export const RENJU_NEWS: NewsArticle[] = [
  {
    id: 'renju-2026-shanhai-cup',
    slug: '2026-national-amateur-renju-king-finals',
    title: '“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛圆满落幕',
    summary:
      '2026年11月中旬，赛事在浙江杭州淳安县下姜村收官，赵云、肖卢卡、陈颢琮分获公开组、U12组与U8组全国业余棋王冠军。',
    content: [
      '据《中国五子棋》微信公众号及官方赛事报道，“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛于2026年11月中旬在浙江杭州淳安县下姜村圆满落幕。',
      '经过多轮激烈对弈与积分角逐，赵云、肖卢卡、陈颢琮分别夺得公开组、U12组与U8组的全国业余棋王冠军，展现了国内业余五子棋群体的竞技水准与梯队活力。',
      '作为面向广大五子棋爱好者的全国性品牌赛事，业余棋王争霸赛持续推动了各地棋友交流与五子棋项目在基层及青少年群体中的普及。',
    ],
    category: 'renju',
    categoryLabel: '五子棋',
    coverImage: '/renju-cover.svg',
    author: {
      id: 'cn-renju-official',
      name: '中国五子棋',
      role: '微信公众号资讯整理',
    },
    publishedAt: '2026-11-16T10:00:00+08:00',
    readTimeMinutes: 3,
    views: 3860,
    isFeatured: true,
    isBreaking: true,
    tags: ['中国五子棋', '棋王争霸赛', '2026'],
  },
  {
    id: 'renju-2026-youth-open',
    slug: '2026-national-youth-renju-open-tianjin',
    title: '2026年全国五子棋青少年公开赛（津南·津沽棋院杯）于天津举办',
    summary:
      '赛事全面执行《中国五子棋竞赛规则（2025年版）》，除U8至U18男女组个人赛外，首次增设超快棋个人赛与超快棋混合团体赛。',
    content: [
      '2026年10月，由国家体育总局棋牌运动管理中心等单位主办的全国五子棋青少年公开赛（“津南·津沽棋院杯”）在天津市津南区（天津科技工作者之家）举行，历时四天。',
      '本次比赛全面执行《中国五子棋竞赛规则（2025年版）》，在保留U8至U18男女组常规个人赛的基础上，创新增设了超快棋个人赛与超快棋混合团体赛，进一步丰富了青少年棋手的实战赛制体验。',
      '赛事期间由《中国五子棋》微信公众号进行了全程跟踪报道，国际跳棋与五子棋两项国家级青少年赛事同期同地办赛，成为年度青少年棋牌赛事的一大亮点。',
    ],
    category: 'renju',
    categoryLabel: '五子棋',
    coverImage: '/renju-cover.svg',
    author: {
      id: 'cn-renju-official',
      name: '中国五子棋',
      role: '微信公众号资讯整理',
    },
    publishedAt: '2026-10-20T09:30:00+08:00',
    readTimeMinutes: 3,
    views: 2940,
    tags: ['中国五子棋', '青少年公开赛', '超快棋'],
  },
  {
    id: 'renju-2025-rules-guide',
    slug: 'china-renju-competition-rules-2025-overview',
    title: '《中国五子棋竞赛规则（2025年版）》全面推行：赛事规范与开局体系解读',
    summary:
      '国家体育总局棋牌运动管理中心推出新版五子棋竞赛规则，在全国锦标赛、公开赛及各地方选拔赛中逐步落地实施。',
    content: [
      '自2025年起，国家体育总局棋牌运动管理中心正式推出《中国五子棋竞赛规则（2025年版）》，并在全国五子棋锦标赛（个人、团体、青少年）及各地官方公开赛中全面推行。',
      '新版规则在开局指定（如塔拉山口-10等标准开局规则）、禁手判罚细则、计时包干及青少年组别规范等方面作出了更清晰的界定，旨在提升正式竞赛的公平性与观赏性。',
      '欲查阅完整竞赛规程、申办公告及历届官方成绩公告，可通过微信搜索关注《中国五子棋》官方微信公众号获取一手文档。',
    ],
    category: 'renju',
    categoryLabel: '五子棋',
    coverImage: '/renju-cover.svg',
    author: {
      id: 'cn-renju-official',
      name: '中国五子棋',
      role: '微信公众号资讯整理',
    },
    publishedAt: '2025-12-01T10:00:00+08:00',
    readTimeMinutes: 4,
    views: 5120,
    tags: ['中国五子棋', '竞赛规则', '塔拉山口-10'],
  },
];
