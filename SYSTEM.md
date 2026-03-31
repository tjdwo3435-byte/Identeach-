# IDenTeach 홈페이지 관리 시스템

## 📁 폴더 구조

```
Folder. try/
├── index.html              ← 메인 홈페이지
├── about.html              ← 회사소개 페이지
├── CNAME                   ← 도메인 설정 (identeach.co.kr)
├── identeach-brand-config.md ← 브랜드 설정 원본
├── SYSTEM.md               ← 이 파일 (관리 가이드)
│
└── assets/
    ├── images/
    │   ├── LOgo.png            ← 로고
    │   ├── team/
    │   │   └── CEO.png         ← 대표 사진
    │   ├── programs/           ← 프로그램별 이미지
    │   │   └── (프로그램명.jpg)
    │   └── activity/           ← 활동 현장 사진 (캐러셀용)
    │       └── (activity1.jpg, activity2.jpg ...)
    └── files/                  ← PDF 제안서 등 다운로드 파일
        └── (proposal.pdf 등)
```

---

## 🖼️ 이미지 추가 방법

구글 드라이브에서 파일 공유 후 링크를 Claude에게 전달하거나
직접 해당 폴더에 파일을 넣어주세요.

| 용도 | 저장 위치 | 권장 크기 |
|------|-----------|-----------|
| 로고 | `assets/images/` | 가로 300px 이상, PNG |
| 대표 사진 | `assets/images/team/` | 세로 600px 이상 |
| 프로그램 사진 | `assets/images/programs/` | 가로 800px, 16:9 비율 |
| 활동 현장 사진 | `assets/images/activity/` | 가로 1200px 이상 |
| PDF 파일 | `assets/files/` | - |

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
| `[회사소개]` | about.html 전체 |
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
| GitHub | github.com/tjdwo3435-byte/testweb |
| 이메일 | idengroup@naver.com |
| 전화 | 010-4084-8962 |
| Formspree ID | mlgondpj |
