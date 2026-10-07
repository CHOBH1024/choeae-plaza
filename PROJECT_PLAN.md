# 최애광장 완성 기준

## 제품 목표

좋아하는 가수의 YouTube 영상, YouTube Music 검색, 네이버 블로그 글과 소식을 가수 상세 화면 한 곳에서 발견하고 저장할 수 있게 한다. 검색 결과와 조회수 표시는 출처·범위를 명확히 하고, 외부 서비스의 원문을 대신하지 않는다.

## 90점 수용 기준

| 영역 | 배점 | 통과 조건 |
| --- | ---: | --- |
| 핵심 흐름 | 25 | 가수 선택 후 영상·음악·블로그로 바로 이동하고 각 콘텐츠가 열림 |
| 사용성·접근성 | 20 | 모바일/데스크톱에서 읽기 쉽고, 키보드·라벨·저장/오류 상태가 이해됨 |
| 데이터·출처 | 20 | Naver/YouTube 응답 검증, 대체 경로, 인기 지표 범위 고지 |
| 보안·개인정보 | 15 | 키는 서버 Secret, 사용자 저장소 격리, 개인정보/약관 정확성 |
| 검색·광고 준비 | 10 | 독창적인 콘텐츠·명확한 출처·탐색 구조 확보; thin page 색인은 차단 |
| 검증·운영 | 10 | 자동 테스트, Preview 확인, 배포 후 로그/연동 점검 절차 |

## 진행 상황

- [x] 가수 상세에 YouTube 영상, YouTube Music 검색, 네이버 블로그 영역을 통합하고 섹션 바로가기 추가
- [x] 이모티콘 중심 UI·기존 이모지 파비콘·가수별 랜딩을 텍스트·모노그램으로 정리
- [x] Naver Blog Search와 최근 영상 조회수 정렬의 서버 프록시 구현
- [x] API 키 미설정/실패 대체 UX, 비밀정보 비노출, 결과 정렬·정화 테스트
- [x] 외부 Naver/YouTube 요청 8초 타임아웃 및 타임아웃 오류의 no-store 회귀 테스트
- [x] 가수 랜딩 페이지는 영상 피드 실패 시 오류 데이터를 사용하지 않고 YouTube ID 형식 검증 후 출력
- [x] 실시간 POMYJO 가수 피드(100명) 대조 후 트레저 API allowlist 및 noindex 랜딩 누락 수정·회귀 테스트
- [x] 실시간 영상 1,258개의 YouTube ID 형식 검증; malformed ID 차단 및 비정상 조회수 처리 추가
- [x] 기본 브라우저 보안 헤더와 모달 키보드 포커스 트랩 보강
- [x] 저장소에서 생성된 Cloudflare 로컬 메타데이터 제거 및 로컬 Secret/cache ignore 회귀 테스트
- [x] Google 저장소 계정 전환/로딩 실패 시 이전 사용자 데이터가 보이지 않도록 보완하고 저장 링크 호스트·HTTPS allowlist 검증
- [x] 기능에 맞게 개인정보처리방침·이용약관 초안 및 운영 설정 안내 갱신
- [ ] 개인정보 공지의 정확성 확정: 계정·댓글·로그의 실제 보유기간/처리위탁을 POMYJO API 설정과 대조하고, POMYJO 공통 방침의 '개인 식별 정보를 수집하지 않는다'는 문구와 현재 로그인·저장·댓글 기능 간 불일치 해소
- [ ] Cloudflare Preview에서 API Secrets 등록 후 Naver/YouTube 실연동 확인
- [ ] Cloudflare Pages Preview·Production Secret 목록이 모두 비어 있음; API Secret을 안전하게 등록한 뒤 각 환경 범위를 확인
- [ ] 현재 Production API 라우트 확인: `/api/blog`와 `/api/popular-videos`가 JSON 대신 사이트 HTML fallback을 반환; Pages Functions Preview/배포 후 재검증
- [ ] POMYJO API의 Google OAuth 세션 쿠키를 브라우저 요청에 전달하고 choeae-plaza origin에 credentialed CORS 허용 (현재 공개 API의 미인증 GET은 401, OPTIONS에 `Access-Control-Allow-Credentials` 없음)
- [x] 320px·375px 모바일과 데스크톱 브라우저 스모크·레이아웃·키보드 포커스 확인(외부 API/플레이어는 모킹)
- [ ] Google 로그인 및 Drive 저장/재로그인 복원 E2E 확인 (backend session/CORS 설정 후)
- [x] GitHub 리뷰 PR 생성
- [x] GitHub Actions 회귀 테스트 워크플로와 Node 테스트 추가
- [x] GitHub Actions 결과 확인 (최신 커밋 CI 통과)
- [x] Wrangler Pages 로컬 런타임에서 정적 페이지·보안 헤더·키 누락 응답·트레저 가수 랜딩 확인
- [ ] Cloudflare 배포 Preview 확인 (프로젝트 Git 연동이 꺼져 있고 배포 목록은 Production뿐; 브랜치 Preview 없음)
- [x] 기존 noindex 유지 및 noindex 페이지를 sitemap에서 제외
- [ ] 독창적인 가수별 편집 콘텐츠가 충분해진 뒤 검색/AdSense 준비 여부 재평가

## 외부 의존성 및 한계

- Cloudflare Pages Secrets가 필요: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, YOUTUBE_API_KEY. 값은 저장소나 채팅에 넣지 않는다.
- 인기 영상은 전체 YouTube 인기 순위가 아니라 사이트가 수집한 최근 영상 중 조회수 순이다.
- 대표곡 선택은 YouTube Music 검색을 새 탭으로 연다. YouTube Music의 자체 플레이어를 사이트 안에 임의로 임베드하지 않는다.
- 변경사항은 운영 배포 전 사용자/리뷰자의 확인을 거친다.
