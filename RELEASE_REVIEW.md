# 최애광장 리뷰·출시 감사

## 범위와 현재 판정

가수 중심의 영상·YouTube Music·블로그·기사 탐색, 로그인 저장소, 모바일/키보드 사용성, 출처·개인정보·외부 API 처리를 검토한다. 기존 정적 홈 + Cloudflare Pages Functions + POMYJO API 구조를 유지한다. **리뷰 가능한 구현은 준비했지만 90점 미션 완료와 운영 출시 승인은 아직 입증되지 않았다.** 테스트 개수를 품질 점수로 환산하지 않는다.

## 증거 대조표 (2026-10-08)

| 요구 | 증거 | 판정/한계 |
|---|---|---|
| 가수별 영상·음악·블로그·기사 탐색 | 실제 Preview BTS/임영웅 상세의 영상·조회수·기사, Naver 8건 표시; `video-loading.test.mjs`, `browser-smoke.mjs` | 영상은 실제 피드, 음악은 정확한 곡 검색 이동. Naver 결과는 정책상 광고 없는 별도 화면이며 한 화면에 전문을 복제하지 않음 |
| 정확한 곡 연결 | 곡 링크/검색이 가수+곡명 query를 사용. `5942f3c` 실제 Preview의 Spring Day 링크 클릭→새 탭 `music.youtube.com/search?q=BTS+Spring+Day`→BTS 봄날 일치 결과 확인 | 상세 대표곡 링크 실제 이동 확인. 음악 자체 재생/전체 링크 성공을 뜻하지 않음. 검색 Enter의 native link 회귀는 별도 확인 |
| 플레이어 동작 | `player-state.test.mjs`: 실제 상태 기반 표시, 자동재생 차단/오류/시간초과, 닫기 후 pending 취소, 가수별 queue 교체. `0735674` 실제 Preview에서 iframe 생성·BTS 영상 재생 및 일시정지 확인 | 실제 video DOM `currentTime=25.36`, `paused=false`, `readyState=4`, 오류 없음; 정지 뒤 `currentTime=33.49`, `paused=true`와 표시 일치. 이 한 영상의 증거를 모든 영상·환경 성공으로 확대하지 않음 |
| 모바일·접근성 | 320/375/1440px overflow·axe, 주요 탭/모달/검색/저장소 검사; 실제 Preview 키보드 선택·Enter·Escape | 최소 YouTube 영역 200×200px 유지, 브라우저 검사에 추가. 자동 검사만으로 모든 접근성 요건을 증명하지 않음 |
| Google 로그인·저장·복원 | 실제 동일 계정 기존 5개 읽기→저장→재조회→서버 logout→재로그인 복원 | 신규 기기 항목 가져오기/별도 실제 계정 전환은 모킹 검증 범위; 사용자 데이터 임의 생성·삭제 없음 |
| 인증/저장 보안 | backend state/PKCE·opaque session·정확한 Origin·소유권·logout, fake Google + 실제 Express 통합 검증 | 승인된 backend 적용. 키/토큰 값은 Git·문서·채팅에 없음. 서버 재시작 시 재로그인 필요 |
| 실패·데이터 정화 | upstream schema/URL/ID/타임아웃·late response·재시도·원본 보존 테스트 | 실제 feed 첫 실패 후 사용자 재시도→5건 복구 확인. 외부 서비스 가용성 보장은 아님 |
| 색인·광고 존중 | 최신 Preview 홈 noindex/기존 AdSense; 블로그/가수 랜딩 noindex·광고 없음, API JSON/보안 헤더 확인 | Production 미변경. AdSense 승인 보장·색인 활성화 없음 |
| 독창적 콘텐츠 | canonical 가수별 감상 안내 4편, 출처/자료 확인일/편집 의견 구분, 생성 asset 일치 테스트 | 100명 전부에 개별 글이 있는 것은 아님. 다른 가수는 명확한 일반 안내 |
| 댓글·통계 보유 | 사용자 선택 댓글 1년/통계 30일, read-only audit, 제한·원자 rollback·site 격리 테스트 | 후보 정리 job/unit 미설치. 삭제·활성화 승인 대기. 실제 정책 시행 완료 아님 |
| 리뷰 전달 | GitHub PR #1 및 실행 가능한 테스트/설정/운영 문서 | PR 머지나 Production 배포와 구분 |

## 출시 전 남은 게이트

1. 정기 정리 설치·초기 실행·향후 기간 초과 영구 삭제에 대한 구체적인 승인. 현재 승인 대기 요청은 유지하며 응답 없이 활성화하지 않는다.
2. 댓글 요청 본인/대상 확인, 정확한 ID별 승인 삭제, 백업 복원 시 삭제 재적용 운영 검토. 로그·백업·요청 처리 기록의 보유기간과 외부 실패 알림 수신처 확정. journal 경고를 이메일 알림으로 설명하지 않는다.
3. POMYJO 공통 개인정보 방침과 최애광장 동기화/처리 주체·위탁 범위의 정합성 검토. 공통 방침을 이 저장소에서 임의 수정하지 않는다.
4. 실제 Preview 내장 영상 1건 재생/일시정지와 대표곡 1건의 새 탭/일치 검색 결과를 확인했다. 검색 Enter 이동, 실제 신규 항목 저장/복원 범위는 추가 확인한다. 브라우저 차단을 우회하거나 쿠키를 외부 도구로 가져오지 않는다.
5. Production Secrets/배포 승인과 운영 도메인의 쿠키·API·저장소·검색 연동 재검증. Preview 성공을 운영 사이트 성공으로 대체하지 않는다.
6. 위 증거를 채운 뒤 `PROJECT_PLAN.md`의 25/20/20/15/10/10 평가표로 전체 요구를 다시 감사한다. 미확인 항목을 통과 처리하지 않는다.

## 실행·복구

`npm ci`, `npm test`, `npm audit --audit-level=moderate`, `npm run test:browser -- http://127.0.0.1:8788`로 검증한다. CI는 pinned Wrangler의 Functions build와 실제 로컬 Pages 런타임을 함께 검사한다. 외부 서비스는 브라우저 스모크에서 모킹하며 실제 계정 확인과 별도 기록한다.

Preview alias: https://codex-finish-choeae-plaza.choeae-plaza.pages.dev

PR: https://github.com/CHOBH1024/choeae-plaza/pull/1

인증 적용/롤백과 삭제 위험은 `backend/README.md`, `backend/PRIVACY_OPERATIONS.md`, `BACKEND_LOGIN_CHECKLIST.md` 참조. 운영 frontend 변경은 기존 승인 범위에 포함되지 않는다. NAVER legacy 인증은 임시 migration fallback이며 API HUB 전환 일정은 README의 공식 출처를 확인한다.

## 아이돌 뮤직 UI 검증 (2026-10-08)

음악 탐색 전용 `/?view=idol`을 추가하고 큰글씨 광장과 동일 데이터/로그인/보관함을 사용하도록 구성했다. 공식 서비스 복제나 Spotify 연동으로 설명하지 않으며 최근 영상 표지를 앨범 커버/실시간 순위로 표시하지 않는다. 테마 저장값을 유지하고 모바일/대형 글씨/모드 전환을 검증했다. Node 98/98 및 신규 음악 허브 5개 화면폭·양 테마·WCAG 자동 감사와 기존 브라우저 회귀 테스트 통과. 실제 외부 API 모킹 범위와 출시 전 승인 게이트는 그대로 유지한다.

### 인터랙션 정리 (2026-10-08)
아이돌 화면의 헤드라인/설명 간격, 아티스트 카드와 음악 목록의 면·테두리·내부 여백을 정돈했습니다. 선택 메뉴의 방향 표시, 키보드 포커스, 마우스 전용 미세 확대와 눌림 피드백을 추가했습니다. 패널 전환은 180ms이며 움직임 최소화에서는 전환/확대가 꺼집니다. 아이돌용 공유 문구는 큰글씨 화면으로 전환할 때 원문으로 복원됩니다. Node 98개와 기존/음악 허브 브라우저 회귀 통과, 음악 허브 검사에 reduced-motion·키보드 outline·문구 복원 확인을 추가했습니다. 로그인·보관함·외부 API 및 운영 배포 범위는 변경하지 않았습니다.

## 현재 아이돌 v2 검증
사용자 요청에 따라 PC 사이드바/카드 선반과 모바일 하단 탐색/스와이프 구성을 분리하고, 시니어 글씨 UI를 트로트 화면으로 제한했다. 기기 최애 저장→첫 화면→새로고침 복원을 별도 테스트 계정이 없는 headless 브라우저에서 확인했다. 타 계정 데이터를 생성/삭제하지 않았다. 활성·온라인 아이돌 화면의5분갱신과 조회수5분캐시/최근수집범위/조회시각, 전체 문의주소 변경을 검증했다. Node102개 및 음악허브/기존회귀 통과. 이는 새 Preview 실연동·운영 배포/정기삭제 승인·90점 완료를 대신하지 않는다.

### Instagram 확장 게이트
사용자 요청으로 Meta 앱 생성/Instagram 연동을 추가한다. 현재 공식 API 프록시/원문 링크/명시적 미연결 상태를 구현하고 Node105개에서 설정 없음·가수/username/URL 정화·토큰 비노출·잘못된 계정·provider 오류를 검사했다. 음악허브 브라우저 테스트는503 미연결과모킹200 원문을 별도로 검사한다. 앱 생성/운영자 로그인/새 권한 승인·실제 게시물 수신은 미완료다. Meta 페이지 열기는 queued 결과이며 생성 완료 증거가 아니다. 현재 브라우저 제어 도구 없음과 다른 Orca runtime 미실행을 확인했으며 계정 쿠키/비밀번호를 임의 추출하지 않았다. 직접 권한 승인 후 Preview Secret 등록/실연동 감사가 남는다. Instagram 준비를 출시/90점 완료로 대체하지 않는다.

## 최신 검증 상태 (2026-10-08 — 앞선 미완료 기록 갱신)
- Meta 앱 최애광장 ID 2267982294049000 생성 완료 및 사용자 승인 후 읽기 권한 4개(instagram_basic, instagram_manage_insights, pages_read_engagement, pages_show_list)의 ‘테스트 준비 완료’ 상태를 실제 UI에서 확인했다. API 호출 수 0. 게시·삭제·DM·광고 관리 권한 미추가. 자세한 범위는 INSTAGRAM_SETUP.md 참조.
- 실계정 연결, 토큰 발급, Secret 등록, 실제 게시물 응답 및 앱 공개는 아직 미완료다. 운영자 Instagram @아이디와 연결 Facebook 페이지 식별을 요청했다.
- 5aaa600 CI37733759051 completed/success 확인. 이 CI의 로컬 Pages 브라우저 회귀는 외부 서비스를 모킹하므로 실계정 연동 성공을 대신하지 않는다.
- 영상 갱신 실패 시 이전 목록과 조회 시각 유지 안내, 아이돌 피드가 비어 있을 때 별도 안내를 추가했다.
- 순위 API의 잘못된 피드/YouTube 응답은 502·no-store로 구분한다. 유효한 빈 목록만 200과 순위 범위·조회 시각을 반환한다. 영상 ID를 중복 제거한 후 최대15개를 조회한다. Node108/108, Wrangler Functions 빌드 통과.
- Production frontend/Secrets/noindex/AdSense/정기 삭제 설치·활성화는 변경하지 않았다. 실제 콘텐츠 최신성, Instagram 연결 및 남은 출시 게이트가 있어 90점 완료 판정은 하지 않는다.
