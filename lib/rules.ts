// lib/rules.ts
// 규칙 기반 피싱/스미싱 탐지 로직 (1단계)
// API 없이 순수 로직만으로 위험도를 계산합니다.
// -> 이 파일 하나만으로도 프로젝트가 "성립"합니다. AI(2단계)는 이 결과를 보강하는 역할입니다.

export type InputType = "email" | "sms";

export interface DetectedFlag {
  label: string;       // 화면에 보여줄 탐지 항목 이름
  detail: string;       // 왜 걸렸는지 구체적인 설명
  score: number;        // 이 항목이 부여하는 점수
  critical?: boolean;   // true면 이 항목 하나만으로도 "위험" 등급을 강제함
}

export interface RuleResult {
  score: number;               // 0~100 사이 최종 위험도 점수
  flags: DetectedFlag[];       // 탐지된 위험 요소들
  riskLevel: "low" | "caution" | "high"; // 위험 등급
}

// ---------------------------------------------
// 1. 알려진 URL 단축 서비스 목록
// ---------------------------------------------
const SHORTENER_DOMAINS = [
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "is.gd",
  "buff.ly", "ow.ly", "shorturl.at", "url.kr", "vo.la",
];

// ---------------------------------------------
// 2. 긴급성을 유발하는 키워드 (한국어 기준)
// ---------------------------------------------
const URGENCY_KEYWORDS = [
  "즉시", "긴급", "지금 바로", "오늘까지", "마지막 기회",
  "계정 정지", "계정 잠금", "정지 예정", "이용 제한",
  "당첨", "무료 혜택", "한정", "선착순",
];

// ---------------------------------------------
// 3. 개인정보/금융정보를 요구하는 패턴
// ---------------------------------------------
const SENSITIVE_INFO_KEYWORDS = [
  "계좌번호", "카드번호", "비밀번호", "인증번호", "보안카드",
  "주민등록번호", "OTP", "CVC", "생년월일 입력",
];

// ---------------------------------------------
// 4. 문자(SMS) 스미싱 특유 패턴
// ---------------------------------------------
const SMS_SPECIFIC_KEYWORDS = [
  "택배", "배송 조회", "결제 확인", "본인 인증", "미납",
  "안심번호", "발신번호",
];

// ---------------------------------------------
// 5. 이메일 첨부파일 유도 문구
// ---------------------------------------------
const ATTACHMENT_LURE_KEYWORDS = [
  "첨부파일 확인", "첨부된 문서", "다운로드 후 실행", "압축파일 해제",
];

// ---------------------------------------------
// 6. 공공기관/수사기관 사칭 패턴 (최신 트렌드)
// -> 최근 스미싱의 상당수가 검찰·경찰·금융감독원 등을 사칭하며
//    "범죄 연루", "계좌 동결" 같은 공포 조장형 문구를 사용함.
//    이 자체로 이미 결정적인 위험 신호이므로 critical로 취급.
// ---------------------------------------------
const GOV_IMPERSONATION_KEYWORDS = [
  "검찰청", "검찰", "경찰청", "금융감독원", "금감원",
  "국민건강보험공단", "건강보험공단", "국세청", "법원", "수사관",
  "형사사건", "범죄에 연루", "계좌가 동결", "계좌 동결", "출석 요구",
  "구속영장", "압수수색", "수사 협조", "명의 도용", "대포통장",
];

// ---------------------------------------------
// 7. 원격 제어/앱 설치 유도 패턴 (최신 트렌드)
// -> 단순 정보 요구를 넘어, 원격제어 앱을 설치시켜 기기를 직접
//    장악하는 결합형 수법. 역시 그 자체로 critical 신호.
// ---------------------------------------------
const REMOTE_CONTROL_KEYWORDS = [
  "원격 제어", "원격제어", "원격 지원", "원격지원", "원격 접속",
  "화면 공유", "앱 설치 후", "보안 앱 설치", "인증 앱 설치",
  "팀뷰어", "TeamViewer", "AnyDesk", "애니데스크",
  "저희 안내에 따라 설치", "링크에서 앱을 설치",
];

// ---------------------------------------------
// 8. 대출/투자 사기 유혹 패턴
// -> 저금리 대환대출, 무담보/무직자 대출, 고수익 보장형 투자 리딩방 등은
//    대표적인 금융 사기 유형이며, 링크나 연락처로 유도하는 경우가 많습니다.
// ---------------------------------------------
const LOAN_INVESTMENT_KEYWORDS = [
  "저금리 대환대출", "무담보 대출", "무직자 대출", "신용조회 없이",
  "당일 대출", "즉시 대출 가능", "고수익 보장", "원금 보장",
  "리딩방", "수익률 보장", "투자 전문가 무료 상담", "선입금",
];

// ---------------------------------------------
// 9. 지인/가족 사칭(메신저 피싱) 패턴
// -> "엄마/아빠 폰 고장" 등으로 접근해 상품권이나 급전을 요구하는
//    메신저 피싱은 그 자체로 결정적인 위험 신호이므로 critical 처리.
// ---------------------------------------------
const IMPERSONATION_MESSENGER_KEYWORDS = [
  "폰 고장", "액정 깨져서", "휴대폰 수리 맡겨", "다른 폰으로 문자",
  "급하게 돈", "잠깐 돈 좀", "상품권 구매", "기프트카드 번호",
  "문화상품권 핀번호", "구글기프트카드",
];

// ---------------------------------------------
// 10. 링크 클릭을 직접적으로 유도하는 일반 표현
// -> 특정 사칭 유형에 속하지 않더라도, 클릭을 재촉하는 문구 자체가
//    피싱 문자/메일에서 매우 흔하게 나타나는 패턴입니다.
// ---------------------------------------------
const CLICK_LURE_KEYWORDS = [
  "아래 링크를 클릭", "링크를 눌러", "지금 클릭", "여기를 눌러주세요",
  "바로가기 확인", "클릭 후 확인",
];

// ---------------------------------------------
// 11. 관세/통관 사기 패턴
// -> 해외직구 배송을 빙자해 관세 미납, 통관 보류 등을 이유로
//    링크 클릭이나 결제를 유도하는 수법입니다.
// ---------------------------------------------
const CUSTOMS_SCAM_KEYWORDS = [
  "관세 미납", "통관 보류", "통관번호 확인", "관세청", "해외직구 통관",
  "국제우편 세관", "세관 신고", "부가세 미납",
];

// ---------------------------------------------
// 12. 청첩장/부고 위장 스미싱 패턴
// -> 모바일 청첩장·부고 안내를 가장해 악성 APK 설치를 유도하는
//    최근 스미싱 트렌드입니다.
// ---------------------------------------------
const INVITATION_OBITUARY_KEYWORDS = [
  "모바일 청첩장", "모바일청첩장", "청첩장 확인", "부고 안내",
  "모바일 부고장", "삼가 고인의 명복을", "결혼식 초대장 확인",
];

// ---------------------------------------------
// 13. 채용/부업 사기 패턴
// -> "고수익 알바", "재택 부업" 등으로 유인해 개인정보나 보증금을
//    요구하는 취업 사기형 스미싱/이메일입니다.
// ---------------------------------------------
const JOB_SCAM_KEYWORDS = [
  "고수익 알바", "재택 부업", "단순 업무 고수익", "일당 지급",
  "출근 없이 근무", "부업 문의", "카톡으로 면접",
];

// ---------------------------------------------
// 14. 결제/로그인 알림 사칭 패턴
// -> 실제 결제·로그인 알림처럼 꾸며 "본인이 아니라면" 클릭을
//    유도하는 확인 유도형 문구입니다.
// ---------------------------------------------
const PAYMENT_LOGIN_ALERT_KEYWORDS = [
  "해외 결제 승인", "카드 결제 승인", "새로운 기기에서 로그인",
  "본인이 아니라면", "결제가 완료되었습니다", "정기결제 자동 갱신",
];

// ---------------------------------------------
// 유틸 함수: 텍스트에서 URL 추출
// -> 문자 메시지는 종종 http:// 없이 "bit.ly/abc123" 형태로 오기 때문에,
//    프로토콜이 없는 형태도 함께 잡아냅니다.
// ---------------------------------------------
function extractUrls(text: string): string[] {
  const withProtocol = /(https?:\/\/[^\s]+)/gi;
  // 프로토콜 없이 "도메인.확장자/경로" 형태로 오는 케이스 (문자에서 흔함)
  const withoutProtocol = /\b([a-z0-9-]+\.(?:com|net|kr|co\.kr|ly|gl|gd)\/[^\s]*)/gi;

  const found = new Set<string>();
  (text.match(withProtocol) || []).forEach((u) => found.add(u));
  (text.match(withoutProtocol) || []).forEach((u) => found.add(`http://${u}`));

  return Array.from(found);
}

// ---------------------------------------------
// 유틸 함수: 두 문자열 간 편집 거리(레벤슈타인 거리) 계산
// -> 유사 도메인(예: arnazon.com vs amazon.com) 탐지에 사용
// ---------------------------------------------
function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

// 잘 알려진 주요 도메인 목록 (유사 도메인 비교 기준)
const KNOWN_DOMAINS = [
  "amazon.com", "coupang.com", "naver.com", "kakao.com",
  "google.com", "hanmail.net", "kb.co.kr", "shinhan.com",
];

function findSimilarDomainFlag(urls: string[]): DetectedFlag | null {
  for (const url of urls) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      for (const known of KNOWN_DOMAINS) {
        // 완전히 같으면 정상 도메인이므로 통과
        if (hostname === known) continue;
        const distance = levenshteinDistance(hostname, known);
        // 편집 거리가 1~2 정도로 아주 가까우면 "유사 도메인 위장" 의심
        if (distance > 0 && distance <= 2) {
          return {
            label: "유사 도메인 발견",
            detail: `"${hostname}"이(가) 공식 도메인 "${known}"과 매우 유사합니다 (편집 거리: ${distance}).`,
            score: 30,
          };
        }
      }
    } catch {
      // URL 파싱 실패 시 무시하고 다음 URL 검사
      continue;
    }
  }
  return null;
}

// ---------------------------------------------
// AI 병합용 카테고리 메타데이터
// -> 규칙 기반이 놓치기 쉬운 "우회 표현"(띄어쓰기, 자모 분리, 특수문자
//    삽입, 은어 등)을 AI가 대신 찾아냈을 때, 동일한 라벨/점수 체계로
//    점수에 반영하기 위한 단일 소스입니다.
//    (URL 기반 카테고리인 단축URL/유사도메인은 텍스트 우회와 무관해 제외)
// ---------------------------------------------
export interface AiCategoryMeta {
  label: string;
  scoreForType?: (type: InputType) => number;
  score?: number;
  critical?: boolean;
  // AI 프롬프트에 보여줄 설명 (해당 카테고리가 어떤 패턴인지)
  promptHint: string;
  // 특정 입력 타입 전용 카테고리인 경우에만 지정
  onlyFor?: InputType;
}

export const AI_CATEGORY_META: Record<string, AiCategoryMeta> = {
  urgency: {
    label: "긴급성 유발 표현",
    scoreForType: (t) => (t === "sms" ? 20 : 15),
    promptHint: "즉시/긴급/계정 정지/당첨/한정/선착순 등 판단을 서두르게 하는 표현",
  },
  sensitive_info: {
    label: "개인/금융 정보 요구",
    score: 25,
    promptHint: "계좌번호/카드번호/비밀번호/인증번호/OTP/주민등록번호 등 민감정보 요구",
  },
  sms_pattern: {
    label: "스미싱 전형 패턴",
    score: 15,
    onlyFor: "sms",
    promptHint: "택배/배송조회/결제확인/본인인증/미납 등 문자 특유 표현",
  },
  attachment_lure: {
    label: "첨부파일 실행 유도",
    score: 15,
    onlyFor: "email",
    promptHint: "첨부파일 확인/다운로드 후 실행/압축파일 해제 등",
  },
  gov_impersonation: {
    label: "공공기관/수사기관 사칭",
    score: 60,
    critical: true,
    promptHint: "검찰/경찰/금융감독원/국세청 등 사칭, 계좌 동결, 출석 요구, 구속영장 등",
  },
  remote_control: {
    label: "원격 제어/앱 설치 유도",
    score: 60,
    critical: true,
    promptHint: "원격제어/화면공유/보안앱 설치 유도, 팀뷰어/AnyDesk 등",
  },
  loan_investment: {
    label: "대출/투자 사기 의심",
    score: 25,
    promptHint: "저금리 대환대출, 무담보 대출, 고수익 보장, 리딩방, 선입금 등",
  },
  impersonation_messenger: {
    label: "지인/가족 사칭 의심",
    score: 55,
    critical: true,
    promptHint: "폰 고장/액정 깨짐을 빙자한 지인·가족 사칭, 상품권·기프트카드·급전 요구",
  },
  click_lure: {
    label: "클릭 유도 표현",
    score: 10,
    promptHint: "아래 링크를 클릭/지금 클릭/여기를 눌러주세요 등 클릭을 재촉하는 일반 표현",
  },
  customs_scam: {
    label: "관세/통관 사기 의심",
    score: 20,
    promptHint: "관세 미납, 통관 보류, 해외직구 통관, 세관 신고 등",
  },
  invitation_obituary: {
    label: "청첩장/부고 위장 스미싱 의심",
    score: 55,
    critical: true,
    promptHint: "모바일 청첩장/부고 안내를 가장한 악성 링크·앱 설치 유도",
  },
  job_scam: {
    label: "채용/부업 사기 의심",
    score: 20,
    promptHint: "고수익 알바, 재택 부업, 단순 업무 고수익 등 취업 사기형 표현",
  },
  payment_login_alert: {
    label: "결제/로그인 알림 사칭 의심",
    score: 20,
    promptHint: "해외 결제 승인, 새로운 기기에서 로그인, 정기결제 자동 갱신 등",
  },
};

// AI 프롬프트에 삽입할 카테고리 설명 목록 텍스트
export function buildAiCategoryPromptList(type: InputType): string {
  return Object.entries(AI_CATEGORY_META)
    .filter(([, meta]) => !meta.onlyFor || meta.onlyFor === type)
    .map(([id, meta]) => `- ${id}: ${meta.label} — ${meta.promptHint}`)
    .join("\n");
}

// AI가 찾아낸 카테고리 id들을 규칙 기반 결과에 병합해 점수를 재계산합니다.
// - 규칙 기반에서 이미 잡힌 라벨은 중복 추가하지 않습니다.
// - 입력 타입에 맞지 않는 카테고리(onlyFor)는 무시합니다.
export function mergeAiDetectedCategories(
  ruleResult: RuleResult,
  type: InputType,
  aiCategoryIds: string[],
  aiEvidence?: Record<string, string>
): RuleResult {
  const existingLabels = new Set(ruleResult.flags.map((f) => f.label));
  const newFlags: DetectedFlag[] = [];

  for (const id of aiCategoryIds) {
    const meta = AI_CATEGORY_META[id];
    if (!meta) continue;
    if (meta.onlyFor && meta.onlyFor !== type) continue;
    if (existingLabels.has(meta.label)) continue;

    const score = meta.scoreForType ? meta.scoreForType(type) : meta.score ?? 0;
    const evidence = aiEvidence?.[id];
    newFlags.push({
      label: meta.label,
      detail: evidence
        ? `AI가 우회 표현(띄어쓰기, 자모 분리, 은어 등)으로 감지: "${evidence}"`
        : "AI가 우회 표현(띄어쓰기, 자모 분리, 은어 등)을 통해 감지했습니다.",
      score,
      critical: meta.critical,
    });
    existingLabels.add(meta.label);
  }

  if (newFlags.length === 0) return ruleResult;

  const allFlags = [...ruleResult.flags, ...newFlags];
  let totalScore = Math.min(100, allFlags.reduce((sum, f) => sum + f.score, 0));
  const hasCriticalFlag = allFlags.some((f) => f.critical);
  if (hasCriticalFlag) totalScore = Math.max(totalScore, 75);

  let riskLevel: RuleResult["riskLevel"] = "low";
  if (totalScore >= 70 || hasCriticalFlag) riskLevel = "high";
  else if (totalScore >= 25) riskLevel = "caution";

  return { score: totalScore, flags: allFlags, riskLevel };
}

// ---------------------------------------------
// 메인 분석 함수
// ---------------------------------------------
export function analyzeWithRules(text: string, type: InputType): RuleResult {
  const flags: DetectedFlag[] = [];
  const urls = extractUrls(text);

  // --- 단축 URL 검사 ---
  const shortenerFound = urls.some((url) =>
    SHORTENER_DOMAINS.some((domain) => url.includes(domain))
  );
  if (shortenerFound) {
    const scoreForType = type === "sms" ? 25 : 15;
    flags.push({
      label: "단축 URL 포함",
      detail: "출처를 숨기기 쉬운 단축 URL 서비스가 사용되었습니다.",
      score: scoreForType,
    });
  }

  // --- 유사 도메인 검사 (이메일에서 더 중요) ---
  if (type === "email") {
    const similarDomainFlag = findSimilarDomainFlag(urls);
    if (similarDomainFlag) {
      flags.push(similarDomainFlag);
    }
  }

  // --- 긴급성 유발 키워드 검사 ---
  const matchedUrgency = URGENCY_KEYWORDS.filter((kw) => text.includes(kw));
  if (matchedUrgency.length > 0) {
    const scoreForType = type === "sms" ? 20 : 15;
    flags.push({
      label: "긴급성 유발 표현",
      detail: `"${matchedUrgency.slice(0, 3).join(", ")}" 등 판단을 서두르게 하는 표현이 발견되었습니다.`,
      score: scoreForType,
    });
  }

  // --- 민감정보 요구 검사 ---
  const matchedSensitive = SENSITIVE_INFO_KEYWORDS.filter((kw) =>
    text.includes(kw)
  );
  if (matchedSensitive.length > 0) {
    flags.push({
      label: "개인/금융 정보 요구",
      detail: `"${matchedSensitive.slice(0, 3).join(", ")}" 등 민감한 정보를 요구하고 있습니다.`,
      score: 25,
    });
  }

  // --- 문자 특유 패턴 검사 ---
  if (type === "sms") {
    const matchedSms = SMS_SPECIFIC_KEYWORDS.filter((kw) => text.includes(kw));
    if (matchedSms.length > 0) {
      flags.push({
        label: "스미싱 전형 패턴",
        detail: `"${matchedSms.slice(0, 3).join(", ")}" 등 택배/결제 사칭에서 자주 쓰이는 표현입니다.`,
        score: 15,
      });
    }
  }

  // --- 첨부파일 유도 검사 (이메일에서만) ---
  if (type === "email") {
    const matchedAttachment = ATTACHMENT_LURE_KEYWORDS.filter((kw) =>
      text.includes(kw)
    );
    if (matchedAttachment.length > 0) {
      flags.push({
        label: "첨부파일 실행 유도",
        detail: "첨부파일을 열거나 실행하도록 유도하는 문구가 있습니다.",
        score: 15,
      });
    }
  }

  // --- 공공기관/수사기관 사칭 검사 ---
  // 검찰/경찰/금감원 등을 사칭하는 문구는 그 자체로 결정적인 위험 신호이므로
  // critical: true 로 표시해 등급 보정 단계에서 강제로 "위험"까지 끌어올립니다.
  const matchedGov = GOV_IMPERSONATION_KEYWORDS.filter((kw) => text.includes(kw));
  if (matchedGov.length > 0) {
    flags.push({
      label: "공공기관/수사기관 사칭",
      detail: `"${matchedGov.slice(0, 3).join(", ")}" 등 공공기관·수사기관을 사칭하여 공포심을 유발하는 표현입니다. 실제 기관은 문자·전화로 계좌 동결이나 출석을 통보하지 않습니다.`,
      score: 60,
      critical: true,
    });
  }

  // --- 원격 제어/앱 설치 유도 검사 ---
  const matchedRemote = REMOTE_CONTROL_KEYWORDS.filter((kw) => text.includes(kw));
  if (matchedRemote.length > 0) {
    flags.push({
      label: "원격 제어/앱 설치 유도",
      detail: `"${matchedRemote.slice(0, 3).join(", ")}" 등 원격제어 앱 설치나 화면 공유를 유도하는 표현입니다. 이런 앱은 기기를 통째로 장악당할 수 있어 매우 위험합니다.`,
      score: 60,
      critical: true,
    });
  }

  // --- 대출/투자 사기 유혹 검사 ---
  const matchedLoanInvestment = LOAN_INVESTMENT_KEYWORDS.filter((kw) =>
    text.includes(kw)
  );
  if (matchedLoanInvestment.length > 0) {
    flags.push({
      label: "대출/투자 사기 의심",
      detail: `"${matchedLoanInvestment.slice(0, 3).join(", ")}" 등 저금리 대출이나 고수익 투자를 미끼로 접근하는 전형적인 금융 사기 표현입니다.`,
      score: 25,
    });
  }

  // --- 지인/가족 사칭(메신저 피싱) 검사 ---
  // "폰이 고장 났다"며 접근해 상품권/급전을 요구하는 수법은 그 자체로
  // 결정적인 위험 신호이므로 critical로 취급합니다.
  const matchedImpersonation = IMPERSONATION_MESSENGER_KEYWORDS.filter((kw) =>
    text.includes(kw)
  );
  if (matchedImpersonation.length > 0) {
    flags.push({
      label: "지인/가족 사칭 의심",
      detail: `"${matchedImpersonation.slice(0, 3).join(", ")}" 등 지인이나 가족을 사칭해 상품권·급전을 요구하는 메신저 피싱에서 흔히 쓰이는 표현입니다.`,
      score: 55,
      critical: true,
    });
  }

  // --- 링크 클릭 유도 일반 표현 검사 ---
  const matchedClickLure = CLICK_LURE_KEYWORDS.filter((kw) => text.includes(kw));
  if (matchedClickLure.length > 0) {
    flags.push({
      label: "클릭 유도 표현",
      detail: `"${matchedClickLure.slice(0, 3).join(", ")}" 등 즉각적인 링크 클릭을 재촉하는 표현이 발견되었습니다.`,
      score: 10,
    });
  }

  // --- 관세/통관 사기 검사 ---
  const matchedCustoms = CUSTOMS_SCAM_KEYWORDS.filter((kw) => text.includes(kw));
  if (matchedCustoms.length > 0) {
    flags.push({
      label: "관세/통관 사기 의심",
      detail: `"${matchedCustoms.slice(0, 3).join(", ")}" 등 해외직구 통관·관세 미납을 빙자해 결제나 클릭을 유도하는 표현입니다.`,
      score: 20,
    });
  }

  // --- 청첩장/부고 위장 스미싱 검사 ---
  // 실제 경조사 안내로 착각하기 쉬워 클릭률이 높은 최신 스미싱 수법이므로
  // critical로 취급합니다.
  const matchedInvitation = INVITATION_OBITUARY_KEYWORDS.filter((kw) =>
    text.includes(kw)
  );
  if (matchedInvitation.length > 0) {
    flags.push({
      label: "청첩장/부고 위장 스미싱 의심",
      detail: `"${matchedInvitation.slice(0, 3).join(", ")}" 등 경조사 안내를 가장해 악성 링크·앱 설치를 유도하는 최신 스미싱 수법입니다.`,
      score: 55,
      critical: true,
    });
  }

  // --- 채용/부업 사기 검사 ---
  const matchedJobScam = JOB_SCAM_KEYWORDS.filter((kw) => text.includes(kw));
  if (matchedJobScam.length > 0) {
    flags.push({
      label: "채용/부업 사기 의심",
      detail: `"${matchedJobScam.slice(0, 3).join(", ")}" 등 고수익 부업을 미끼로 접근하는 취업 사기형 표현입니다.`,
      score: 20,
    });
  }

  // --- 결제/로그인 알림 사칭 검사 ---
  const matchedPaymentAlert = PAYMENT_LOGIN_ALERT_KEYWORDS.filter((kw) =>
    text.includes(kw)
  );
  if (matchedPaymentAlert.length > 0) {
    flags.push({
      label: "결제/로그인 알림 사칭 의심",
      detail: `"${matchedPaymentAlert.slice(0, 3).join(", ")}" 등 실제 결제·로그인 알림처럼 꾸며 확인을 유도하는 표현입니다.`,
      score: 20,
    });
  }

  // --- 최종 점수 계산 (100점 상한) ---
  let totalScore = Math.min(
    100,
    flags.reduce((sum, flag) => sum + flag.score, 0)
  );

  const hasCriticalFlag = flags.some((flag) => flag.critical);

  // 안전장치: critical 패턴이 하나라도 걸리면, 다른 항목이 안 걸려서
  // 합산 점수가 낮게 나오더라도 최소 75점 이상 & "위험" 등급으로 강제합니다.
  // (공공기관 사칭이나 원격제어 유도는 그 자체로 이미 명백한 사기 수법이기 때문)
  if (hasCriticalFlag) {
    totalScore = Math.max(totalScore, 75);
  }

  let riskLevel: RuleResult["riskLevel"] = "low";
  if (totalScore >= 70 || hasCriticalFlag) riskLevel = "high";
  else if (totalScore >= 25) riskLevel = "caution";

  return { score: totalScore, flags, riskLevel };
}
