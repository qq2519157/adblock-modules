# 红果短剧去广告模块（Surge）

iOS 红果免费短剧（bundle `com.phoenix.video`，App Store id 6451407032）的去广告 Surge 模块。
参考 fmz200/wool_scripts 的 FanQieNovel.sgmodule 结构，融合 6 个社区已验证实现并经 iPad 实测校准。

## 反编译实证总架构（红果 Android 7.4.2.32，2026-10-28）

官方包（com.phoenix.read，应用宝直链）25 dex + 230MB 代码反编译（jadx+apktool），此前推断全部升级为代码实证。主命名空间 `com.dragon.read`（与番茄小说同源）。

**三大架构事实**：

1. **直播卡 100% 服务端决策、客户端零开关**：服务端在推荐/剧集 feed 响应里直接下发直播 cell（`ShowType` 604=双列/605=单列，ShowType.java:441-442），payload 为 `cell.roomList[0]=LiveRoomData{roomId,status,rawStreamData,streamOrientation}`；AIGC 电商卡走 `POST /reading/playlet/shortbuy_api/get_aigc_to_live_card/v1/`，响应 `cards[].card_json` 二次 JSON = `AdRemainNaturalMaterials[]{lynx_url,lynx_data,meterial_id（服务端拼写如此）,type}`——**素材本体是 Lynx 卡片**。客户端唯一可为：预检掉卡、内存去重、长按负反馈。网络层只能断粮道，不能断源头。
2. **拉流 URL 客户端零硬编码**：`douyincdn.com`/`pull-flv`/`pull-q`/`/third/`/`/stage/` 全 APK **0 命中**——URL 100% 由服务端房间信息 JSON 下发，客户端只按 `streamInfo[resolution][main|backup][format]` 取值拼 query（LiveStreamInfo.java:2046-2124）。`http://<IP>/<原host>/<path>` 形态的成因=TTNet native httpdns（`setTTDNSServerHost("dig.bdurl.net")`）解析后由 .so 重写 URL，302 亦保 IP。scheme 重写表（LiveStreamInfo.java:758-773）：`tcp→http、tls→https、quic→httpq、kcp→httpk、h2→httpx`——**httpq/httpk/httpx 是 TTNet 私有协议，Surge URL 层不可见**，域名/SNI 层是唯一兜底。format 枚举全集：flv/hls/lls/llash/cmaf/ts/rtmp/avph/tsl/rtm，后缀 `.flv`/`index.m3u8`/`.sdp`，路径 token `stream-<quality>_<resolution>`，`only_audio=1` 音频流。URL 可能整体加密下发（EncryptLivePlayerClient）。
3. **MITM 死路定案**：全 APK 无任何 SPKI/CertificatePinner pin 名单；"证书固定"实质=TTNet 自带 Cronet 只信平台信任库（k0.java AndroidCAStore）+ NSC（res/xml/e.xml）无 base-config trust-anchors——**用户 CA（Surge/Proxyman）在 release 包确定不被信任**。下方「实验分支：内容 API 路径层」灰度序列正式作废，MITM 路线关闭。顺带：`cleartextTrafficPermitted=true`，明文 http 拉流是官方设计而非漏洞。

**附：dns105 域名调度总表**（mc5/a.java:13 内置兜底，可被 TNC 在线更新）：`log→log5-applog`、`mon→mon11-misc`、`rtlog→rtlog5-applog`、`ad→ads5-normal（备 ads3）`、机房三线 -hl/-lf/-lq、tnc 族（alisc1/aliec2/bjlgy）、httpdns IP 表 101.36.166.16-19——v1.3 凭实抓写的埋点通配与机房变体**全部获代码级依据**。

**附：RPC 契约速查**（供抓包比对，不做改写——pinned 域写不了脚本）：shortbuy_api 12 端点（get_aigc_to_live_card 等，s7$a.smali:18-341）+ commerceapi `patch_plan/delivery_plan/product_card/refresh_live_gold/ad/report/impression/show_click`（scene 枚举 SeriesPatch=3/StopPatch=4/SeriesPatchNew=5）；ReportAdScene 0-28（AIGCToLive=28/AutoEnterLive=2/AdRemainLive=6）。剧集间插播决策字段在服务端物料（MaterialExtra.advertise_show_type FirstRefresh=1/AllDay=2 + 17 类混插卡类型表），客户端无本地频控。

**附：开关全表（ssconfig/AB，全部服务端可控）**：直播卡总开关 `ecom_series_force_card_v731`、开播前预检 `video_live_pre_check_config_v723`、`live_polling_config_v727`、`ec_aigc_seeding_config_v727` 等；取值优先级 sticky→debug panel→libra AB→settings→默认（ExperimentManager.java:300-345）。**注意**：本模块已拦 i.snssdk.com/TNC → AB/settings 下发降级到 sticky 缓存+内置默认——此拦截的副作用影响面首次有解释（理论上有助于锁住"直播卡不展示"类开关的旧值）。

**附：静态分析极限**：直播渲染主体在运行时下载的 `lib_plugin_plugin-live.so`（LIVESDK_VERSION=4250）内，宿主 APK 只有桥接接口；native 层（libttplayer/libsscronet.so）的 IP 重写拼接未反汇编；拉流域名全集不可静态获得（服务端下发）。

## v1.2 更新日志（2026-10-26）

针对「模块置底仍被主配置 China 域名集压制」与「直播广告音视频照播」的根因修复。

**两个根因（官方手册背书）**：

1. **HTTPDNS 裸 IP 直连 + SNI 匹配缺失**：红果用自带 HTTPDNS 把域名解析成 IP 后直连，域名只出现在 TLS SNI 里。v1.1 的规则没带 `extended-matching` 参数（manual.nssurge.com/rules/domain.html："Also match the TLS SNI and the HTTP Host header… This helps when a client connects to an IP address directly"，iOS 5.8.0+），所以匹配不上；主配置 DOMAIN-SET 带了该参数就能靠 SNI 抢走——完美复现实测现象。官方手册同时确认：模块 [Rule] 一律插在主配置规则**最顶部**，模块列表位置只决定模块之间的顺序——「拖到最底下」从来不是问题所在。
2. **直播广告拉流走「裸 IP + 明文 HTTP + 域名藏路径」暗道**：实测 `http://<IP>/pull-flv-h1.douyincdn.com/third/stream-xxxx_hd5.flv?wsSecret=...`（t_id 时间戳与广告弹出秒级吻合）。连接无域名、无 DNS，域名规则与 [Host] 全部失明；[URL Rewrite] 在 HTTP 层求值、先于规则引擎，是唯一能拦住它的层。

**v1.3（2026-10-26）**：①拉流 kill 升宽匹配——第三形态出现（`IP + /pull-q3.douyincdn.com/stage/`，阿里线路+stage 路径），路径级 narrowing 失效，改为 `pull-(flv|hls|q)[^\/]*\.douyincdn\.com` 双形态任意路径，显式排除 `pull-lls*`（推送通道），代价=本机抖音系直播观看失效；②修埋点域机房坑——`DOMAIN-KEYWORD,-misc.fqnovel.com` 匹配不到 `mon11-misc-lf`（机房后缀夹中间，abclq 警告过的坑），补 `mon*-misc*` / `log*-applog*` / `rtlog*-applog*` 通配（[Rule]+[Host] 双层）。另：实测日志证实模块规则+extended-matching 按 SNI 正常抢先命中（正片白名单生效），模块排序机制无问题。

**v1.2.1 补丁（2026-10-26）**：实测打地鼠序列——裸 IP 形态被杀后 350ms 内 App 改用**域名直连形态**重试（`http://pull-flv-q1.douyincdn.com/third/...`），v1.2 正则只匹配"域名藏路径"形态导致漏杀。修正为 `(?:[^\/]+\/)?pull-flv-[^\/]*\.douyincdn\.com\/third\/` 双形态覆盖。

**v1.2 改动**：

1. 所有活跃 REJECT 与正片 DIRECT 白名单全量追加 `extended-matching`（裸 IP+SNI 场景覆盖；白名单也必须加，否则 REJECT 补齐 SNI 后正片裸 IP 连接会掉进主配置规则被送代理）
2. 新增 `[Host]` DNS 黑洞段（127.0.0.1 权威应答，先于规则引擎、不受 DOMAIN-SET 压制；`*foo.com` 形式覆盖裸域+子域；通配跨横杠合法）
3. 新增 `[URL Rewrite]` 拉流 kill：先只杀 `pull-flv-*.douyincdn.com/third/`（第三方流），宽匹配升级位注释备用（全开会挡本机所有抖音系直播观看）
4. 新增 `DOMAIN-KEYWORD,httpdns,REJECT`（Kelee Block_HTTPDNS 先例）断 DNS 旁路，逼 App 回退系统 DNS
5. 新增白山云节点 `v9-default.tt.x.bsgslb.cn` 试验拦截（广告素材嫌疑；正片异常删该行）
6. pre-matching 全保留（iOS 5.14+ 支持 DOMAIN-WILDCARD；旧版本对未知参数静默忽略不报错）

**装/测排障清单（重要，缺一步都可能误判模块无效）**：

1. 模块开关在**当前生效 profile** 里必须开启（官方记录过 iCloud 同步清缓存会静默取消模块勾选的 bug）
2. **手动重装一次模块**：raw.githubusercontent.com 国内直连经常失败，URL 安装的自动更新可能一直静默失败，手机上可能根本不是最新版
3. 模块页查配置错误（iOS 5.8.1+ 会报确切行号）
4. 清空「最近请求」→ 杀红果重开触发广告 → 看新记录命中规则（注意 pre-matching REJECT 每条规则每 5 分钟只记一条，没刷出来≠没命中）
5. Surge DNS/请求日志查 ads3 有无 DNS 查询记录：没有 = HTTPDNS 裸 IP 实锤（v1.2 第 4 条是解法）；有 = 模块没加载，回到 1-3



针对实机反馈「刷几集后仍弹直播商品广告」与「ads3 请求走 DIRECT」的修复：

1. **pre-matching**：所有无白名单冲突的 REJECT 加 `,pre-matching`（DNS/TCP 阶段求值，优先于一切普通规则）——主配置里更宽泛的 snssdk/zijieapi/douyin 直连规则不再能压住模块。故意不加 pre-matching 的：`-ad-sign` 族（与 p3-ad-sign DIRECT 例外冲突）、`ecombdapi` 族（保留用户可覆盖性）。若模块加载报错，全局删掉 `,pre-matching` 后缀即可退回。
2. **直播带货卡片信令域**（用户实机抓包定位 + abclq/CLQ_Shield/gitlawyercan/anpplex 四源印证）：`webcast*-open*.douyin.com`（含 CNAME 真身 `.c.dsa.cdnbuild.net`）、`webcast-open.douyin.com`、`content-open.douyin.com`、`pangolin*.snssdk.com`。断直播间数据供给，卡片无从渲染；代价=红果内跳真实直播间失效（广告落地页，属预期）。
3. **信封修复**：v1 的 Map Local `data="{}"` 缺 `status_code`，穿山甲 SDK 视为解析错误≈网络错误→反复重试（"拦不死"嫌疑之一）。改为 app2smile/rules 的 adsense.js 脚本，命中广告（响应含 message 字段）时替换为官方无填充信封 `{status_code:20001, reason:112}`；`is.snssdk.com` 从 REJECT 候选改为放行+脚本接手。
4. **证书固定情报落地**（gitlawyercan 实测）：`ecombdapi.com`、`ads*.zijieapi.com`、`gecko*.zijieapi.com`、`chengzijianzhan.com`、`ugsdk.cn`、`p*-ad-sign.byteimg.com`、`p*-developer-sign.bytemaimg.com`、`api*-normal-*.fqnovel.com` 均有证书固定。这些域只走域名层 REJECT（TLS 握手前断连，不受 pinning 影响），不做任何 MITM 依赖。

## 上划门禁 3s/5s/0s 差异的代码定案（2026-10-28）

倒计时秒数 = 服务端逐条物料下发的 `forced_viewing_time`（int），客户端无时长硬编码。门禁决策树（竖版 `s63/n.smali`、横版 `j53/f.smali`）四分支：① 值 ≤0 → 日志「服务端策略，非强制广告」直接解锁（=免等）；② 同物料倒计时已存在/已跑完 → 复用（`elapsedRealtime` 绝对截止，滑走再回免等）；③ 回刷/重建不重置；④ 值 >0 → 「强制观看，开始倒计时」时长 `(值+0.1)×1000ms`，渲染 `%1$ds后可继续上滑观看短剧` 等文案（BottomContainer）。取值优先级（`w73/e.b`）：`adChannel=="natural"`（自然量/暗投，含伪装直播）取 `OneStopAdModel` 顶层字段，普通取 `ad_data.style_extra.forced_viewing_time`；伪装直播卡另有 `AigcToLiveCard.forced_viewing_time`。并行第二条计时：CTA「浏览Xs立即看下集」由 `style_extra.skip_landing_page_time` 驱动，与上划门禁独立。`ReaderAdConfig` 的 5000/3 默认值属漫画/品牌章前广告场景，不参与短剧门禁。实操：同一条广告等过一次滑回免等；「非强制广告」物料可秒跳；镜像双指滚动事件绕过整个门禁。

## 为什么 iPad 上没有这个广告（终局结论，2026-10-28 闭环）

排查矩阵（全部实测排除）：✗ 越狱插件（iPad 抓包显示 App 主动发起直播卡全套域名的 DNS 查询，无本地拦截痕迹）；✗ 旧版兼容（App Store 7.4.1 最低要求 iOS 14，iPad 已更新最新版）；✗ 账号差异（两端同账号）；✗ 登录态失效（2026-10-28 验证：iPad 历史记录同步正常，登录态有效）。

**唯一变量 = 设备本身**：服务端按 device_id 维度画像（机型/系统版本/设备活跃度，经 device_register 上报）分层运营。商业侧：广告主投放直播带货卡时排除 iPad/旧 iOS 设备（渲染兼容与转化率考虑）——iPad 是"没人投"，不是"拦得住"。内容侧（2026-10-28 补充实证）：同账号下 iPhone（高活+新系统）吃新剧冷启动探索流量，iPad（低活+旧系统）被回灌验证过的存量内容（看过的剧复推）——与广告不投放是同一套设备分层逻辑的两面。iPhone 作为被投放方，卡片本体经 pinning 保护的内容 API 下发、拉流多 CDN 弹性换形，网络层只能断粮道无法断源头，此为架构性极限。

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

## 实验分支：内容 API 路径层（⛔ 2026-10-28 作废——反编译实证 TTNet Cronet 不信用户 CA，MITM 必被拒；以下保留仅供考古）

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

已关闭（2026-10-28 反编译定案）：~~api/ad 承载子域~~、~~feed 广告字段名~~（字段已实证（card_json/AdRemainNaturalMaterials/ShowType 604/605），但 MITM 死路使改写脚本不可行，条目关闭）；~~MITM 灰度序列~~（作废）。

- [ ] iPhone 实机验证 v1.4：dig.zjurl.cn / IP-CIDR 101.36.166.16/30 是否同款生效（Android 包实证，iOS 构建待证）
- [ ] .sdp 拉流形态实抓（若出现即开注释实验位）
- [ ] sinfonline UG 挂件域 / zlink.fqnovel.com / v0-video-cn-private 在 iOS 流量中的出现率（决定注释可选位去留）
- [ ] jadx 跑完后复核 smali @SerializedName 结论（目标类已核，模型类增量复核）
- [ ] 开屏广告专用端点（现有规则未覆盖，可能在 ssconfig/ab/config 下发）
- [ ] `hongguoapp.com` / `hongguosdk.com`（Tartarus2014 单一来源）与 8 个随机子域 CDN 在 iOS 侧是否实际出现

## 上游致谢

- [laincat/Rules](https://github.com/laincat/Rules) · HongGuo.sgmodule（DIRECT 白名单顺序设计）
- [k6nfmm7dbr-commits/hongguo-lite](https://github.com/k6nfmm7dbr-commits/hongguo-lite)（基础/Plus 版，Map Local 空响应）
- [bluee1111/egern-hongguo-adblock](https://github.com/bluee1111/egern-hongguo-adblock)
- [doovvip/sublink-worker2](https://github.com/doovvip/sublink-worker2) · HongGuo-Surge-Native V1.1.0（实机验证）
- [abclq/home-dns-adblock](https://github.com/abclq/home-dns-adblock)（安卓无 root 实抓 558 域回测案例）
- [fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)（结构参考）
