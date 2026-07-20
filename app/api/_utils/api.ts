import { NextResponse } from "next/server"
import type { TeamMember, TeamRole, User } from "@prisma/client"
import { authenticate } from "@/lib/auth"
import { localeFromRequest, resolveLocale, t, type AppLocale } from "@/lib/i18n"
import { prisma } from "@/lib/prisma"

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AuthedUser = User

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json(data)
}

export function bad(message = "参数不正确", status = 400) {
  return NextResponse.json({ error: message }, { status })
}

const apiErrorMessages: Record<string, Partial<Record<AppLocale, string>> & { en: string; "zh-Hans": string; "zh-Hant": string }> = {
  "参数不正确": {
    en: "Invalid parameters",
    "zh-Hans": "参数不正确",
    "zh-Hant": "參數不正確",
    ja: "パラメータが正しくありません",
    ko: "매개변수가 올바르지 않습니다",
    ar: "المعلمات غير صحيحة",
    de: "Ungültige Parameter",
    fr: "Paramètres invalides",
    it: "Parametri non validi",
  },
  "未授权或登录已过期": {
    en: "Unauthorized or login expired",
    "zh-Hans": "未授权或登录已过期",
    "zh-Hant": "未授權或登入已過期",
    ja: "未認証、またはログインの有効期限が切れています",
    ko: "인증되지 않았거나 로그인이 만료되었습니다",
    ar: "غير مصرح أو انتهت صلاحية تسجيل الدخول",
    de: "Nicht autorisiert oder Anmeldung abgelaufen",
    fr: "Non autorisé ou session expirée",
    it: "Non autorizzato o accesso scaduto",
  },
  "服务器错误，请稍后再试": {
    en: "Server error. Please try again later",
    "zh-Hans": "服务器错误，请稍后再试",
    "zh-Hant": "伺服器錯誤，請稍後再試",
    ja: "サーバーエラーです。しばらくしてからもう一度お試しください",
    ko: "서버 오류입니다. 잠시 후 다시 시도하세요",
    ar: "خطأ في الخادم. يرجى المحاولة لاحقًا",
    de: "Serverfehler. Bitte versuche es später erneut",
    fr: "Erreur serveur. Veuillez réessayer plus tard",
    it: "Errore del server. Riprova più tardi",
  },
  "请输入有效的邮箱地址": {
    en: "Please enter a valid email address",
    "zh-Hans": "请输入有效的邮箱地址",
    "zh-Hant": "請輸入有效的電子郵件地址",
    ja: "有効なメールアドレスを入力してください",
    ko: "유효한 이메일 주소를 입력하세요",
    ar: "يرجى إدخال عنوان بريد إلكتروني صالح",
    de: "Bitte gib eine gültige E-Mail-Adresse ein",
    fr: "Veuillez saisir une adresse e-mail valide",
    it: "Inserisci un indirizzo email valido",
  },
  "验证码不存在，请重新获取": {
    en: "Verification code not found. Please request a new one",
    "zh-Hans": "验证码不存在，请重新获取",
    "zh-Hant": "驗證碼不存在，請重新取得",
    ja: "認証コードが見つかりません。再取得してください",
    ko: "인증 코드가 없습니다. 다시 요청하세요",
    ar: "رمز التحقق غير موجود. يرجى طلب رمز جديد",
    de: "Bestätigungscode nicht gefunden. Bitte fordere einen neuen an",
    fr: "Code de vérification introuvable. Veuillez en demander un nouveau",
    it: "Codice di verifica non trovato. Richiedine uno nuovo",
  },
  "验证码已过期，请重新获取": {
    en: "Verification code expired. Please request a new one",
    "zh-Hans": "验证码已过期，请重新获取",
    "zh-Hant": "驗證碼已過期，請重新取得",
    ja: "認証コードの有効期限が切れました。再取得してください",
    ko: "인증 코드가 만료되었습니다. 다시 요청하세요",
    ar: "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد",
    de: "Bestätigungscode abgelaufen. Bitte fordere einen neuen an",
    fr: "Code de vérification expiré. Veuillez en demander un nouveau",
    it: "Codice di verifica scaduto. Richiedine uno nuovo",
  },
  "验证码错误": {
    en: "Incorrect verification code",
    "zh-Hans": "验证码错误",
    "zh-Hant": "驗證碼錯誤",
    ja: "認証コードが正しくありません",
    ko: "인증 코드가 올바르지 않습니다",
    ar: "رمز التحقق غير صحيح",
    de: "Falscher Bestätigungscode",
    fr: "Code de vérification incorrect",
    it: "Codice di verifica errato",
  },
  "验证码错误或已过期": {
    en: "Verification code is incorrect or expired",
    "zh-Hans": "验证码错误或已过期",
    "zh-Hant": "驗證碼錯誤或已過期",
    ja: "認証コードが正しくないか、有効期限が切れています",
    ko: "인증 코드가 올바르지 않거나 만료되었습니다",
    ar: "رمز التحقق غير صحيح أو منتهي الصلاحية",
    de: "Bestätigungscode ist falsch oder abgelaufen",
    fr: "Le code de vérification est incorrect ou expiré",
    it: "Il codice di verifica è errato o scaduto",
  },
  "无团队访问权限": { en: "No team access permission", "zh-Hans": "无团队访问权限", "zh-Hant": "沒有團隊存取權限" },
  "无团队管理权限": { en: "No team management permission", "zh-Hans": "无团队管理权限", "zh-Hant": "沒有團隊管理權限" },
  "无总管理员权限": { en: "No super admin permission", "zh-Hans": "无总管理员权限", "zh-Hant": "沒有總管理員權限" },
  "团队不存在": { en: "Team does not exist", "zh-Hans": "团队不存在", "zh-Hant": "團隊不存在" },
  "项目不正确": { en: "Invalid project", "zh-Hans": "项目不正确", "zh-Hant": "專案不正確" },
  "项目不存在": { en: "Project does not exist", "zh-Hans": "项目不存在", "zh-Hant": "專案不存在" },
  "成员不存在": { en: "Member does not exist", "zh-Hans": "成员不存在", "zh-Hant": "成員不存在" },
  "照片不存在": { en: "Photo does not exist", "zh-Hans": "照片不存在", "zh-Hant": "照片不存在" },
  "图片下载失败": { en: "Image download failed", "zh-Hans": "图片下载失败", "zh-Hant": "圖片下載失敗" },
  "邮件类型不正确": { en: "Invalid email type", "zh-Hans": "邮件类型不正确", "zh-Hant": "郵件類型不正確" },
  "请输入 feedID": { en: "Please enter feedID", "zh-Hans": "请输入 feedID", "zh-Hant": "請輸入 feedID" },
  "请输入 photoID": { en: "Please enter photoID", "zh-Hans": "请输入 photoID", "zh-Hant": "請輸入 photoID" },
  "动态不存在": { en: "Feed does not exist", "zh-Hans": "动态不存在", "zh-Hant": "動態不存在" },
  "无重复照片处理权限": { en: "No duplicate photo handling permission", "zh-Hans": "无重复照片处理权限", "zh-Hant": "沒有重複照片處理權限" },
  "该照片不在重复组内，不能通过此页面删除": {
    en: "This photo is not in a duplicate group and cannot be deleted from this page",
    "zh-Hans": "该照片不在重复组内，不能通过此页面删除",
    "zh-Hant": "該照片不在重複組內，不能透過此頁面刪除",
  },
  "保留照片不能删除，请删除重复项": {
    en: "The kept photo cannot be deleted. Please delete a duplicate instead",
    "zh-Hans": "保留照片不能删除，请删除重复项",
    "zh-Hant": "保留照片不能刪除，請刪除重複項",
  },
  "签名不正确": { en: "Invalid signature", "zh-Hans": "签名不正确", "zh-Hant": "簽名不正確" },
  "邀请链接不存在或已失效": { en: "Invite link does not exist or has expired", "zh-Hans": "邀请链接不存在或已失效", "zh-Hant": "邀請連結不存在或已失效" },
  "邀请链接已过期": { en: "Invite link has expired", "zh-Hans": "邀请链接已过期", "zh-Hant": "邀請連結已過期" },
  "邀请邮箱与当前账号不匹配": { en: "Invite email does not match the current account", "zh-Hans": "邀请邮箱与当前账号不匹配", "zh-Hant": "邀請電子郵件與目前帳號不符" },
  "请输入有效的团队码": { en: "Please enter a valid team code", "zh-Hans": "请输入有效的团队码", "zh-Hant": "請輸入有效的團隊碼" },
  "团队码不存在或已失效": { en: "Team code does not exist or has expired", "zh-Hans": "团队码不存在或已失效", "zh-Hant": "團隊碼不存在或已失效" },
  "只有创建者可以调整团队角色": {
    en: "Only the owner can change team roles",
    "zh-Hans": "只有创建者可以调整团队角色",
    "zh-Hant": "只有建立者可以調整團隊角色",
  },
  "不能修改自己的创建者角色": {
    en: "You cannot change your own owner role",
    "zh-Hans": "不能修改自己的创建者角色",
    "zh-Hant": "不能修改自己的建立者角色",
  },
  "只能设置为管理员或普通成员": {
    en: "Role can only be set to admin or member",
    "zh-Hans": "只能设置为管理员或普通成员",
    "zh-Hant": "只能設定為管理員或一般成員",
  },
  "转让创建者请使用团队转让接口": {
    en: "Use the team transfer API to transfer ownership",
    "zh-Hans": "转让创建者请使用团队转让接口",
    "zh-Hant": "轉讓建立者請使用團隊轉讓接口",
  },
  "创建者需要先转让团队": {
    en: "The owner must transfer the team first",
    "zh-Hans": "创建者需要先转让团队",
    "zh-Hant": "建立者需要先轉讓團隊",
  },
  "缺少 Google identityToken": {
    en: "Missing Google identity token",
    "zh-Hans": "缺少 Google identityToken",
    "zh-Hant": "缺少 Google identityToken",
  },
  "Google 返回的邮箱格式不正确": {
    en: "Google returned an invalid email address",
    "zh-Hans": "Google 返回的邮箱格式不正确",
    "zh-Hant": "Google 傳回的電子郵件格式不正確",
  },
  "Google 登录未配置 GOOGLE_CLIENT_IDS": {
    en: "Google sign-in is not configured",
    "zh-Hans": "Google 登录未配置 GOOGLE_CLIENT_IDS",
    "zh-Hant": "Google 登入未設定 GOOGLE_CLIENT_IDS",
  },
  "Google 登录失败": {
    en: "Google sign-in failed",
    "zh-Hans": "Google 登录失败",
    "zh-Hant": "Google 登入失敗",
  },
}

Object.assign(apiErrorMessages["参数不正确"], {
  fa: "پارامترها نامعتبر هستند",
  ru: "Некорректные параметры",
  uk: "Некоректні параметри",
  hi: "अमान्य पैरामीटर",
  zu: "Amapharamitha awalungile",
  ro: "Parametri nevalizi",
  nl: "Ongeldige parameters",
})

Object.assign(apiErrorMessages["未授权或登录已过期"], {
  fa: "مجوز ندارید یا ورود منقضی شده است",
  ru: "Нет авторизации или срок входа истек",
  uk: "Немає авторизації або термін входу минув",
  hi: "अनधिकृत या लॉगिन समाप्त हो गया है",
  zu: "Awugunyaziwe noma isikhathi sokungena siphelelwe",
  ro: "Neautorizat sau autentificarea a expirat",
  nl: "Niet geautoriseerd of sessie verlopen",
})

Object.assign(apiErrorMessages["服务器错误，请稍后再试"], {
  fa: "خطای سرور. لطفاً بعداً دوباره تلاش کنید",
  ru: "Ошибка сервера. Попробуйте позже",
  uk: "Помилка сервера. Спробуйте пізніше",
  hi: "सर्वर त्रुटि। कृपया बाद में फिर कोशिश करें",
  zu: "Iphutha leseva. Sicela uzame futhi kamuva",
  ro: "Eroare de server. Încearcă mai târziu",
  nl: "Serverfout. Probeer het later opnieuw",
})

Object.assign(apiErrorMessages["请输入有效的邮箱地址"], {
  fa: "لطفاً یک نشانی ایمیل معتبر وارد کنید",
  ru: "Введите корректный адрес электронной почты",
  uk: "Введіть коректну адресу електронної пошти",
  hi: "कृपया एक मान्य ईमेल पता दर्ज करें",
  zu: "Sicela ufake ikheli le-imeyili elivumelekile",
  ro: "Introdu o adresă de e-mail validă",
  nl: "Voer een geldig e-mailadres in",
})

Object.assign(apiErrorMessages["验证码不存在，请重新获取"], {
  fa: "کد تأیید پیدا نشد. لطفاً دوباره درخواست کنید",
  ru: "Код подтверждения не найден. Запросите новый",
  uk: "Код підтвердження не знайдено. Запитайте новий",
  hi: "सत्यापन कोड नहीं मिला। कृपया नया कोड मांगें",
  zu: "Ikhodi yokuqinisekisa ayitholakali. Sicela ucele entsha",
  ro: "Codul de verificare nu a fost găsit. Cere unul nou",
  nl: "Verificatiecode niet gevonden. Vraag een nieuwe aan",
})

Object.assign(apiErrorMessages["验证码已过期，请重新获取"], {
  fa: "کد تأیید منقضی شده است. لطفاً دوباره درخواست کنید",
  ru: "Срок действия кода истек. Запросите новый",
  uk: "Термін дії коду минув. Запитайте новий",
  hi: "सत्यापन कोड समाप्त हो गया है। कृपया नया कोड मांगें",
  zu: "Ikhodi yokuqinisekisa isiphelelwe. Sicela ucele entsha",
  ro: "Codul de verificare a expirat. Cere unul nou",
  nl: "Verificatiecode verlopen. Vraag een nieuwe aan",
})

Object.assign(apiErrorMessages["验证码错误"], {
  fa: "کد تأیید نادرست است",
  ru: "Неверный код подтверждения",
  uk: "Неправильний код підтвердження",
  hi: "सत्यापन कोड गलत है",
  zu: "Ikhodi yokuqinisekisa ayilungile",
  ro: "Cod de verificare incorect",
  nl: "Onjuiste verificatiecode",
})

Object.assign(apiErrorMessages["验证码错误或已过期"], {
  fa: "کد تأیید نادرست است یا منقضی شده است",
  ru: "Код подтверждения неверен или истек",
  uk: "Код підтвердження неправильний або прострочений",
  hi: "सत्यापन कोड गलत है या समाप्त हो गया है",
  zu: "Ikhodi yokuqinisekisa ayilungile noma isiphelelwe",
  ro: "Codul de verificare este incorect sau expirat",
  nl: "Verificatiecode is onjuist of verlopen",
})

Object.assign(apiErrorMessages["无团队访问权限"], {
  fa: "مجوز دسترسی به تیم ندارید",
  ru: "Нет доступа к команде",
  uk: "Немає доступу до команди",
  hi: "टीम एक्सेस अनुमति नहीं है",
  zu: "Ayikho imvume yokufinyelela eqenjini",
  ro: "Nu ai permisiune de acces la echipă",
  nl: "Geen toegang tot team",
})

Object.assign(apiErrorMessages["无团队管理权限"], {
  fa: "مجوز مدیریت تیم ندارید",
  ru: "Нет прав управления командой",
  uk: "Немає прав керування командою",
  hi: "टीम प्रबंधन अनुमति नहीं है",
  zu: "Ayikho imvume yokuphatha iqembu",
  ro: "Nu ai permisiune de administrare a echipei",
  nl: "Geen beheerrechten voor team",
})

Object.assign(apiErrorMessages["无总管理员权限"], {
  fa: "مجوز مدیر کل ندارید",
  ru: "Нет прав суперадминистратора",
  uk: "Немає прав суперадміністратора",
  hi: "सुपर एडमिन अनुमति नहीं है",
  zu: "Ayikho imvume yomlawuli omkhulu",
  ro: "Nu ai permisiune de super administrator",
  nl: "Geen superbeheerdersrechten",
})

Object.assign(apiErrorMessages["团队不存在"], {
  fa: "تیم وجود ندارد",
  ru: "Команда не существует",
  uk: "Команди не існує",
  hi: "टीम मौजूद नहीं है",
  zu: "Iqembu alikho",
  ro: "Echipa nu există",
  nl: "Team bestaat niet",
})

Object.assign(apiErrorMessages["项目不存在"], {
  fa: "پروژه وجود ندارد",
  ru: "Проект не существует",
  uk: "Проєкту не існує",
  hi: "प्रोजेक्ट मौजूद नहीं है",
  zu: "Iphrojekthi ayikho",
  ro: "Proiectul nu există",
  nl: "Project bestaat niet",
})

Object.assign(apiErrorMessages["成员不存在"], {
  fa: "عضو وجود ندارد",
  ru: "Участник не существует",
  uk: "Учасника не існує",
  hi: "सदस्य मौजूद नहीं है",
  zu: "Ilungu alikho",
  ro: "Membrul nu există",
  nl: "Lid bestaat niet",
})

Object.assign(apiErrorMessages["照片不存在"], {
  fa: "عکس وجود ندارد",
  ru: "Фото не существует",
  uk: "Фото не існує",
  hi: "फ़ोटो मौजूद नहीं है",
  zu: "Isithombe asikho",
  ro: "Fotografia nu există",
  nl: "Foto bestaat niet",
})

export function apiErrorMessage(locale: AppLocale | string | undefined, message: string) {
  const resolved = resolveLocale(locale)
  return apiErrorMessages[message]?.[resolved] || apiErrorMessages[message]?.en || message
}

export function badFor(req: Request, message = "参数不正确", status = 400) {
  return bad(apiErrorMessage(localeFromRequest(req), message), status)
}

export function serverError(req: Request) {
  return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
}

export async function readBody(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function requireUser(req: Request) {
  const result = await authenticate(req)
  return result?.user ?? null
}

export function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.toLowerCase().trim() : ""
}

export function roleIDToRole(roleID: unknown): TeamRole {
  if (roleID === 1 || roleID === "1") return "OWNER"
  if (roleID === 2 || roleID === "2") return "ADMIN"
  return "MEMBER"
}

export function roleToID(role: TeamRole) {
  if (role === "OWNER") return 1
  if (role === "ADMIN") return 2
  return 3
}

export function roleToName(role: TeamRole, locale: AppLocale | string = "zh-Hans") {
  if (role === "OWNER") return t(locale, "role.owner")
  if (role === "ADMIN") return t(locale, "role.admin")
  return t(locale, "role.member")
}

export function canManage(member: Pick<TeamMember, "role"> | null | undefined) {
  return member?.role === "OWNER" || member?.role === "ADMIN"
}

export async function getTeamMember(groupID: unknown, userID: string) {
  if (typeof groupID !== "string" || !groupID) return null
  return prisma.teamMember.findUnique({
    where: { groupID_userID: { groupID, userID } },
  })
}

export async function requireTeamMember(groupID: unknown, userID: string) {
  const member = await getTeamMember(groupID, userID)
  if (!member) return null
  return member
}

export async function requireTeamManager(groupID: unknown, userID: string) {
  const member = await getTeamMember(groupID, userID)
  if (!canManage(member)) return null
  return member
}

export function asStringArray(value: unknown) {
  if (typeof value === "string") return [value]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export function asNumberArray(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? [numberValue] : []
  }
  if (!Array.isArray(value)) return []
  return value.map(Number).filter((item) => Number.isFinite(item))
}

export function pageArgs(body: Record<string, unknown>) {
  const pageIndex = Math.max(Number(body.pageIndex ?? 1), 1)
  const pageSize = Math.min(Math.max(Number(body.pageSize ?? 20), 1), 100)
  return { skip: (pageIndex - 1) * pageSize, take: pageSize }
}

export function rangeWhere(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const range = value as { startTimeStamp?: unknown; endTimeStamp?: unknown }
  const start = range.startTimeStamp == null ? undefined : BigInt(Number(range.startTimeStamp))
  const end = range.endTimeStamp == null ? undefined : BigInt(Number(range.endTimeStamp))
  if (start == null && end == null) return undefined
  return { gte: start, lte: end }
}

export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, item) => {
      if (typeof item === "bigint") return Number(item)
      if (item && typeof item === "object" && typeof item.toNumber === "function") {
        return item.toNumber()
      }
      return item
    }),
  )
}
