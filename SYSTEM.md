# IDenTeach 홈페이지 관리 시스템

## 📁 폴더 구조

```
Folder. identeach/
├── index.html                  ← 메인 홈페이지
├── about/index.html            ← 회사소개 페이지
├── request/index.html          ← 문의 페이지
├── career/                     ← 진로 프로그램 상세 페이지들
│   ├── index.html
│   ├── talkshow/index.html
│   ├── job-lab/index.html
│   ├── touching-voice/index.html
│   └── ceo-talk/index.html
├── together/                   ← 어울림 프로그램 상세 페이지들
│   ├── index.html
│   ├── domino/index.html
│   ├── schoolping/index.html
│   ├── facilitation/index.html
│   └── violence-prevention/index.html
├── logo-intro.html             ← 브랜드 오프닝 애니메이션
├── CNAME                       ← 도메인 설정 (identeach.co.kr)
├── identeach-brand-config.md   ← 브랜드 토큰/색상 설정 원본
├── SYSTEM.md                   ← 이 파일 (관리 가이드)
│
└── assets/
    ├── documents/              ← 다운로드 파일
    │   ├── identeach-program-guide.pdf  ← 프로그램 소개서
    │   └── proposal.pdf                 ← 제안서
    ├── images/
    │   ├── logo.png / logo-white.png    ← 로고
    │   ├── hero/               ← 메인 슬라이드 이미지
    │   ├── gallery/            ← 갤러리 이미지 (g1~g8.jpg)
    │   ├── team/               ← 팀/대표 사진
    │   ├── characters/         ← 브랜드 캐릭터 PNG
    │   ├── objects/            ← 아이콘 오브젝트 PNG
    │   ├── activity/           ← 활동 현장 사진
    │   │   └── field-photos/   ← 현장 변형 사진
    │   ├── programs/           ← 프로그램별 이미지
    │   │   ├── career/
    │   │   ├── together/
    │   │   └── _source/        ← 소스/참고 이미지 (미사용)
    │   ├── eyebrow/            ← 섹션 타이틀 이미지
    │   └── reference/          ← 참고 이미지
    ├── characters/             ← 캐릭터 PNG (별도 루트)
    ├── music/                  ← 배경음악
    └── objects/                ← 오브젝트 PNG
```

---

## 🖼️ 이미지 추가 방법

파일을 해당 폴더에 직접 넣고 Claude에게 경로를 알려주세요.

| 용도 | 저장 위치 | 권장 크기 |
|------|-----------|-----------|
| 로고 | `assets/images/` | 가로 300px 이상, PNG |
| 대표 사진 | `assets/images/team/` | 세로 600px 이상 |
| 프로그램 사진 | `assets/images/programs/` | 가로 800px, 16:9 비율 |
| 활동 현장 사진 | `assets/images/activity/` | 가로 1200px 이상 |
| PDF 다운로드 파일 | `assets/documents/` | - |

---

## ✏️ 수정 요청 명령어

### 섹션별 명령어 형식
```
[섹션명] 내용: 변경값
```

### 섹션 목록
| 명령어 | 수정되는 곳 |
|--------|------------|
| `[NAV]` | 상단 네비게이션 |
| `[히어로]` | 첫 화면 (타이틀, 배지, 버튼) |
| `[WHY]` | "새로운 프로그램을 원하시나요" 섹션 |
| `[결과물]` | 결과물이 남는 프로그램 섹션 |
| `[프로그램-학교]` | 학교 프로그램 탭 |
| `[프로그램-공공]` | 공공기관 프로그램 탭 |
| `[프로그램-커스텀]` | 커스텀 프로그램 카드 |
| `[철학]` | 교육 철학 섹션 |
| `[문의]` | 하단 문의 섹션 |
| `[회사소개]` | about/index.html 전체 |
| `[CEO]` | 대표 소개 |
| `[전체]` | 공통 적용 (색상, 폰트 등) |

### 예시
```
[히어로] 타이틀: 경험이 만드는 나다움
[프로그램-학교] EnterAIment Quest 비용: 250만원
[결과물] 이미지 추가: activity1.jpg
[문의] 전화번호: 010-0000-0000
```

---

## 🚀 배포 흐름

```
수정 요청 → Claude가 코드 수정 → git push → 1~2분 후 identeach.co.kr 반영
```

---

## 📌 주요 정보

| 항목 | 값 |
|------|-----|
| 도메인 | identeach.co.kr |
| GitHub | github.com/tjdwo3435-byte/Identeach- |
| 이메일 | idengroup@naver.com |
| 전화 | 010-4084-8962 |
| Formspree ID | mlgondpj |
