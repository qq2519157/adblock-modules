# 红果短剧去广告模块（Surge）

iOS 红果免费短剧（bundle `com.phoenix.video`，App Store id 6451407032）的去广告 Surge 模块。
参考 fmz200/wool_scripts 的 FanQieNovel.sgmodule 结构，融合 6 个社区已验证实现并经 iPad 实测校准。

## v1.1 更新日志（2026-10-26）

针对实机反馈「刷几集后仍弹直播商品广告」与「ads3 请求走 DIRECT」的修复：

1. **pre-matching**：所有无白名单冲突的 REJECT 加 `,pre-matching`（DNS/TCP 阶段求值，优先于一切普通规则）——主配置里更宽泛的 snssdk/zijieapi/douyin 直连规则不再能压住模块。故意不加 pre-matching 的：`-ad-sign` 族（与 p3-ad-sign DIRECT 例外冲突）、`ecombdapi` 族（保留用户可覆盖性）。若模块加载报错，全局删掉 `,pre-matching` 后缀即可退回。
2. **直播带货卡片信令域**（用户实机抓包定位 + abclq/CLQ_Shield/gitlawyercan/anpplex 四源印证）：`webcast*-open*.douyin.com`（含 CNAME 真身 `.c.dsa.cdnbuild.net`）、`webcast-open.douyin.com`、`content-open.douyin.com`、`pangolin*.snssdk.com`。断直播间数据供给，卡片无从渲染；代价=红果内跳真实直播间失效（广告落地页，属预期）。
3. **信封修复**：v1 的 Map Local `data="{}"` 缺 `status_code`，穿山甲 SDK 视为解析错误≈网络错误→反复重试（"拦不死"嫌疑之一）。改为 app2smile/rules 的 adsense.js 脚本，命中广告（响应含 message 字段）时替换为官方无填充信封 `{status_code:20001, reason:112}`；`is.snssdk.com` 从 REJECT 候选改为放行+脚本接手。
4. **证书固定情报落地**（gitlawyercan 实测）：`ecombdapi.com`、`ads*.zijieapi.com`、`gecko*.zijieapi.com`、`chengzijianzhan.com`、`ugsdk.cn`、`p*-ad-sign.byteimg.com`、`p*-developer-sign.bytemaimg.com`、`api*-normal-*.fqnovel.com` 均有证书固定。这些域只走域名层 REJECT（TLS 握手前断连，不受 pinning 影响），不做任何 MITM 依赖。

## 直播卡片网络指纹（实机抓包，2026-10-25）

广告爆发簇（同一拍 10 次，插在正片 CDN 请求间隙）：

| 面 | 域名 | 作用 |
|---|---|---|
| 信令 | `webcast3-open-hl.douyin.com` / `webcast5-open-hl.douyin.com` | 直播间开放接口（卡片数据源）→ **已拦** |
| 信令 | `content-open.douyin.com` | 直播内容开放接口 → **已拦** |
| 信令 | `webcast.amemv.com` | 房间信息（出现 1 次，复现再拦） |
| 电商 | `isaas5-normal-hl.ecombdapi.com` ×10 | 商品接口（有 pinning，域名层拦） |
| 图片 | `p3-webcast.douyinpic.com` ×10 | 封面图 → **勿拦**（拦了只白图，杀不死卡片） |
| 图片 | `p3/p26-item.ecombdimg.com` | 电商图床 → **勿拦**（通用图床） |
| 正片 | `v5-se2-alismart-reading-video.qznovelvod.com` ×84 | 正片 CDN（白名单保护对象） |

勿拦清单（多源实测误伤）：`p*-webcast.douyinpic.com`（封面白屏）、`pull-lls-*.douyincdn.com`（直播拉流+推送共用）、`webcast5-ws-web-*.douyin.com`（真直播弹幕 WS）、`douyinpic.com`/`ecombdimg.com`（通用图床）、`bytegecko.com`（H5 离线包，白屏风险）、`pitaya.bytedance.com`（播放器配置）、`amemv.com` 裸域（抖音主域）。

## 「3-5 秒才能上划」与镜像秒跳的原理

该门槛是客户端「滑动锁」：广告层挂"5s后可继续上滑"提示（Android 无障碍项目 ad-auto 实测横屏锁期约 12 秒），锁期内触摸手势一律无效，锁一解除滑动立即生效。iPhone 镜像把触控板双指上划作为**指针滚动事件**注入，不走手指触摸的命中测试/遮罩拦截，直接驱动滚动视图翻页——"锁住了手指，没锁住滚动"。跳过动作不做服务端校验。

## 实验分支：内容 API 路径层（默认关闭，灰度序列）

APK 静态提取出的第一方广告/直播卡端点（host `api*-normal-*.fqnovel.com`，iOS 在用性待证）：

- `GET /reading/commerceapi/ad/patch_plan/v2/`、`/reading/commerceapi/ad/delivery_plan/v2/`（广告排期）
- `POST /reading/playlet/shortbuy_api/get_aigc_to_live_card/v1/`（AIGC→直播卡片）
- `GET /reading/commerceapi/product/card/v1/`（商品卡）
- `POST /novel/player/multi_video_detail/v1/`、`multi_video_model(/preload)/v1/`（分集/播放模型，检查广告位字段）

灰度序列（严格按序，任一异常立即回退）：
1. MITM 只加 `api5-normal-hl.fqnovel.com`（追加到 hostname 行末尾）
2. 先跑 dump-only 脚本（只 console.log 顶层 key + 含 room_id/webcast/anchor/live 语义的字段，不改写）
3. 确认响应结构与字段名后，才写正式改写（候选：布尔旗标翻转 / 广告数组清空，套 wool zhihu.js 模式）
4. 该域承载全部内容 API 且实测有证书固定：黑屏/转圈/断连立即删掉退回纯域名版


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
