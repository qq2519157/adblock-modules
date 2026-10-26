// 红果短剧 - 穿山甲 get_ads「无填充」信封
// 改编自 app2smile/rules js/adsense.js 穿山甲分支（MIT，生产验证）
// 错误码说明: https://www.csjplatform.com/supportcenter/5421
// 逻辑: 响应含 message 字段 = 有广告 → 整体替换为官方无填充信封(status_code=20001, reason=112)
//       空响应 / 已是无填充 → 原样放行（$done({}) = 放行，避免断连触发 SDK 重试）

const url = $request.url;

let obj = null;
if ($response.body) {
    try {
        obj = JSON.parse($response.body);
    } catch (e) {
        console.log(`JSON 解析失败: ${e}`);
    }
}

if (obj && obj.message) {
    console.log(`穿山甲-get_ads 命中广告: ${url}`);
    $done({
        body: JSON.stringify({
            request_id: 'F5617E54-3FF4-4052-9B09-4227D09B5105',
            status_code: 20001,
            reason: 112,
            desc: '该代码位请求量过大且消耗过低，因此填充率控制在10%以内，该策略每日生效，如果当天该代码位的消耗上涨或请求量小于5000，则次日不会命中该策略'
        })
    });
} else {
    $done({});
}
