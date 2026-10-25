# 红果短剧去广告模块（Surge）

iOS 红果免费短剧（bundle `com.phoenix.video`，App Store id 6451407032）的去广告 Surge 模块。
参考 fmz200/wool_scripts 的 FanQieNovel.sgmodule 结构，融合 6 个社区已验证实现并经 iPad 实测校准。

## 文件

- `HongGuoDuanJu.sgmodule` — 模块本体
- `research/` — 调研归档：6 个上游实现原文件、abclq 安卓实抓案例研究、27-agent 调研知识库全文

## 安装

- iPhone Surge：模块 → 从文件安装（AirDrop 过去），或放到任意可访问的 URL 用「从链接安装」
- Mac Surge：直接拖入或链接安装
- Egern / Shadowrocket 可直接导入 sgmodule；Loon/Stash 需转换（https://script-hub.nfdns.top）

## 分层原理

| 层 | 手段 | 覆盖 |
|---|---|---|
| 域名层（无需 MITM，拦掉大头） | `[Rule]` REJECT | 穿山甲 SDK 族（pangolin/pglstatp/pangle）、红果自有广告投放 API（`ads*-normal*.zijieapi.com`，三机房 -hl/-lf/-lq 全覆盖）、贴片广告视频 CDN（`v*-reading-ad.qznovelvod.com`，正片 `reading-video` 显式放行）、广告签名图床（`p*-ad-sign.byteimg.com`）、埋点上报 |
| 路径层（需 MITM） | `[Map Local]` 空 JSON + `[URL Rewrite]` reject | 穿山甲 `get_ads` 聚合接口、红果自有 API 广告路径 `*.snssdk.com/api/ad/`、开屏素材包 `gurd` 下发 |

## 验证清单（装模块后）

1. 杀掉红果冷启动 → 开屏应直接过或秒跳
2. 首页信息流 → 无卡片广告/直播推广
3. 连续播放/切集 → 无片头插屏（缓存的开屏素材要等过期或重装 App 才消失）
4. 封面图、漫画图正常（黑屏/缺图 = 正片 DIRECT 白名单被你的其他规则抢先，检查模块规则排序）
5. 登录、评论、推送正常
6. Surge Dashboard 按域名搜 `pangolin`/`ads3`，应显示命中 REJECT

## 回退开关

- 红果打不开/一直转圈 → 疑似证书固定：先删 `[MITM]` 里 `*.snssdk.com`，再不行删整个 MITM 段（纯域名版已拦大头）
- 商城用不了 → 注释 `ecombdapi.com` 段
- 小游戏入口没了 → 注释 `minigame*` 两行
- 登录异常 → 注释 `i*.snssdk.com` 几行

## 关键设计依据（2026-10-25 实测/调研）

1. **无广告 iPad 仍请求 `ads3-normal-hl.zijieapi.com`**（本机 mitmproxy WireGuard 抓包 DNS 层证实）→ 无广告是服务端按设备形态不填充，域名层拦 ads* 对 iPhone 是正确路线
2. iOS 实测机房变体：iPhone 见 `-lf`（api5-normal-sinfonlinec/mon11-misc-lf/log5-applog-lf），iPad 见 `-hl` → 通配规则全机房覆盖
3. laincat 白名单缺口修复：`api*-normal-*.fqnovel.com,DIRECT` 补上 `api5-normal-sinfonlineb/c`（内容+风控 API，绝不拦）
4. `pull-lls-*.douyincdn.com`（长连接推送）、`frontier*`（推送通道）、`gecko*/bsync*/polaris*`（运营配置基建）、`fqnovelpic.com`（图床）全部不拦
5. 绝不能整域 REJECT：snssdk.com / zijieapi.com / byteimg.com / pstatp.com / fqnovel.com / fqnovelpic.com / douyincdn.com（广告素材与正片/图床共用，abclq 实抓 558 域中 461 个是正片 CDN）
6. 金币功能官方已公告 2026-12-31 前全面下线，「拦截广告影响激励任务」的顾虑即将自动消失

## 待办（后续迭代）

- [ ] iPhone 实机装模块验证：Surge 面板确认 ads3/pangolin 命中情况
- [ ] 红果自有 API 广告路径 `*.snssdk.com/api/ad/` 的具体承载子域（需响应体抓包）
- [ ] 开屏广告专用端点（现有规则未覆盖，可能在 ssconfig/ab/config 下发）
- [ ] feed/player 接口响应体中的广告字段名（multi_video_detail / multi_video_model，写 JS 改写脚本前必须实抓）
- [ ] `hongguoapp.com` / `hongguosdk.com`（Tartarus2014 单一来源）与 8 个随机子域 CDN 在 iOS 侧是否实际出现

## 上游致谢

- [laincat/Rules](https://github.com/laincat/Rules) · HongGuo.sgmodule（DIRECT 白名单顺序设计）
- [k6nfmm7dbr-commits/hongguo-lite](https://github.com/k6nfmm7dbr-commits/hongguo-lite)（基础/Plus 版，Map Local 空响应）
- [bluee1111/egern-hongguo-adblock](https://github.com/bluee1111/egern-hongguo-adblock)
- [doovvip/sublink-worker2](https://github.com/doovvip/sublink-worker2) · HongGuo-Surge-Native V1.1.0（实机验证）
- [abclq/home-dns-adblock](https://github.com/abclq/home-dns-adblock)（安卓无 root 实抓 558 域回测案例）
- [fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)（结构参考）
