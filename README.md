# adblock-modules

个人维护的去广告代理模块集合（Surge 为主，Egern / Shadowrocket 可直接导入 sgmodule，Loon / Stash 可经 [Script-Hub](https://script-hub.nfdns.top) 转换）。

规则基于社区多个已验证实现交叉核对 + 实机抓包校准，每条规则注明来源与取舍依据。

## 模块列表

| 模块 | 平台 | 说明 | 一键安装 |
|---|---|---|---|
| 红果短剧 | Surge | 拦穿山甲 SDK / 剧集贴片 / 开屏素材 / 埋点 / 电商推广，保正片与登录 | [Surge 安装](https://api.boxjs.app/surge/install-module?url=https%3A%2F%2Fraw.githubusercontent.com%2Fqq2519157%2Fadblock-modules%2Fmain%2Fsurge%2FHongGuoDuanJu.sgmodule) |
| └ 详细文档 | — | 分层原理 / 验证清单 / 回退开关 / 设计依据 | [docs/hongguo.md](docs/hongguo.md) |

## 使用注意

1. 模块 `[Rule]` 需排在主配置里更宽泛的直连规则（如 `snssdk.com / zijieapi.com` 整域 DIRECT）之前才会生效
2. 部分广告素材有本地缓存，装模块后需清除 App 缓存或重装 App 才完全生效
3. 遇到 App 打不开/功能异常，先看各模块文档里的「回退开关」一节

## 致谢与来源

- [laincat/Rules](https://github.com/laincat/Rules) · [k6nfmm7dbr-commits/hongguo-lite](https://github.com/k6nfmm7dbr-commits/hongguo-lite) · [bluee1111/egern-hongguo-adblock](https://github.com/bluee1111/egern-hongguo-adblock) · [doovvip/sublink-worker2](https://github.com/doovvip/sublink-worker2) · [abclq/home-dns-adblock](https://github.com/abclq/home-dns-adblock) · [fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)

## License

[MIT](LICENSE)
