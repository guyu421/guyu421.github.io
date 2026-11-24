// Oracle Cloud 数据库 API 配置
// 填写 apiBaseUrl 与对应 endpoints 后，页面改为从 Oracle Cloud 接口取数；
// 留空时读取本地 data/ 下由数据库表导出的数据。
// tournament.tournament_id 为正整数主键（1..n），renju_prematch 与
// tournament_player 的 tournament_id 同步使用该整数；
// renju_prematch.id 为对局正整数编号（1..n）。编号只在数据库中使用，页面不展示。
// 赛事日期范围由 renju_prematch.date 的 MIN/MAX 按 tournament_id 聚合得到。
window.RENJU_CONFIG = {
  apiBaseUrl: "",
  token: "",
  table: {
    games: "renju_prematch",
    tournaments: "tournament",
    players: "player"
  },
  endpoints: {
    games: "",
    tournaments: "",
    players: ""
  }
};
