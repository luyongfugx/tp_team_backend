// Reviewed website/H5 wording. Keep generated translations reproducible;
// native source translations remain owned by the iOS localization workflow.
export const verificationCopyOverrides = {
  en: {
    warningTitle: "Information does not match", partialTitle: "Some information could not be confirmed",
    trust1Title: "Network time. Protected location.",
    trust1Body: "Timeprint automatically calibrates capture time using trusted network time. Manually changing the phone’s clock cannot change the real capture time recorded by Timeprint. Timeprint uses accurate positioning and prohibits virtual locations from being used to falsify the capture location, protecting the authenticity of capture records.",
    trust2Title: "A photo code connects to the original record",
    trust2Body: "A photo with a photo code lets you look up its original capture time and location. You can also upload it to compare its time, location and image with the original record.",
    trust3Title: "Check changes against the original record",
    trust3Body: "If AI or editing tools have changed the time, location, photo content or background, verification compares the information it can check with the original record. When a difference is found, the report identifies the checks that did not pass. Workers can submit records with supporting evidence, and managers can review them with greater confidence.",
  },
  "zh-Hans": {
    warningTitle: "发现信息不一致", partialTitle: "部分信息无法确认",
    trust1Title: "网络时间校准，禁止虚拟定位",
    trust1Body: "Timeprint 使用可信的网络标准时间自动校准拍摄时间，即使手动修改手机系统时间，也无法改变 Timeprint 记录的真实拍摄时间。同时，Timeprint 使用准确定位，禁止通过虚拟定位伪造拍摄地点，保障拍摄记录的真实性。",
    trust2Title: "照片码关联原始拍摄记录",
    trust2Body: "带照片码的照片，既可查询原始拍摄时间和地点，也可上传核对时间、地点和画面。",
    trust3Title: "修改或 AI 改图，逐项核对",
    trust3Body: "针对 AI 或修图工具修改时间、地点、照片内容或背景的情况，验真功能会将可核验的信息与原始记录逐项比对，发现不一致时，明确指出未通过的核验项目。从拍摄记录到照片核验，让真实性有据可查，让员工提交有依据，让老板核验更放心。",
  },
  "zh-Hant": {
    warningTitle: "發現資訊不一致", partialTitle: "部分資訊無法確認",
    trust1Title: "網路時間校準，禁止虛擬定位",
    trust1Body: "Timeprint 使用可信的網路標準時間自動校準拍攝時間，即使手動修改手機系統時間，也無法改變 Timeprint 記錄的真實拍攝時間。同時，Timeprint 使用準確定位，禁止透過虛擬定位偽造拍攝地點，保障拍攝記錄的真實性。",
    trust2Title: "照片碼連結原始拍攝記錄",
    trust2Body: "帶照片碼的照片，既可查詢原始拍攝時間和地點，也可上傳核對時間、地點和畫面。",
    trust3Title: "修改或 AI 修圖，逐項核對",
    trust3Body: "針對 AI 或修圖工具修改時間、地點、照片內容或背景的情況，驗真功能會將可核驗的資訊與原始記錄逐項比對，發現不一致時，明確指出未通過的核驗項目。從拍攝記錄到照片核驗，讓真實性有據可查，讓員工提交有依據，讓老闆核驗更放心。",
  },
};
verificationCopyOverrides["zh-HK"] = {...verificationCopyOverrides["zh-Hant"], trust1Title:"網絡時間校準，禁止虛擬定位", trust1Body:verificationCopyOverrides["zh-Hant"].trust1Body.replaceAll("網路", "網絡")};
