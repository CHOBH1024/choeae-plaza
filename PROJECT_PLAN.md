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
- [x] 2026-09-07 시행 네이버 검색 API 약관을 확인해 검색결과를 광고 없는 별도 페이지에 독립 표시하고 출처를 연결; 결과 저장·응답 캐싱을 제거
- [x] 이모티콘 중심 UI·기존 이모지 파비콘·가수별 랜딩을 텍스트·모노그램으로 정리
- [x] 프런트엔드에 남은 빈 emoji 데이터 필드도 제거하고 회귀 테스트 추가
- [x] 대표곡 미등록 가수도 YouTube Music 검색으로 이어지도록 상세 음악 영역에 대체 링크 제공
- [x] 오늘의 노래는 표시된 곡·가수와 일치하는 YouTube Music 검색을 열고, 이전의 최신영상 재생 오동작을 수정
- [x] 시간이 바뀐 정적 방송 편성 정보 대신 프로그램 영상 검색과 방송사 편성표 확인 안내 제공
- [x] Naver Blog Search와 최근 영상 조회수 정렬의 서버 프록시 구현
- [x] NAVER API HUB 검색 endpoint·인증 헤더를 기본으로 사용하고 기존 Developer Center 키는 종료 기한이 있는 migration fallback으로 한정
- [x] 가수 SEO·블로그·인기 영상 API에서 중복되던 가수 allowlist를 공유 모듈 하나로 통합하고 동기화 회귀 테스트 추가
- [x] API 키 미설정/실패 대체 UX, 비밀정보 비노출, 결과 정렬·정화 테스트
- [x] 배포 API 경로가 HTML fallback을 반환해도 JSON 오류 대신 YouTube/Naver 검색 대안을 안내하고 회귀 테스트
- [x] Naver 공식 검색 예시의 HTTP 리다이렉트 링크를 신뢰 도메인에서만 HTTPS로 승격하고 피싱 호스트를 차단·테스트
- [x] Naver 결과의 HTML 태그·named/numeric entity를 일반 텍스트로 정화하고 회귀 테스트
- [x] 외부 Naver/YouTube 요청 8초 타임아웃 및 타임아웃 오류의 no-store 회귀 테스트
- [x] 가수 랜딩 페이지는 영상 피드 실패 시 오류 데이터를 사용하지 않고 YouTube ID 형식 검증 후 출력
- [x] 잘못된/미등록 가수 페이지는 명시적인 noindex 404와 no-store 응답으로 종료
- [x] 가수 랜딩의 피드 요청 대기 상한을 로컬 런타임에서 확인된 12초에서 3.5초로 단축
- [x] 실시간 POMYJO 가수 피드(100명) 대조 후 트레저 API allowlist 및 noindex 랜딩 누락 수정·회귀 테스트
- [x] 한글 카탈로그 장르 값과 영문 필터 키의 불일치를 바로잡아 트로트/아이돌 필터 및 카드 상세 분류 라벨을 수정·브라우저 회귀 검증
- [x] 장르 전환 색상 애니메이션이 순간적인 대비 위반을 만들지 않도록 수정하고 전환 상태에서 Axe 검사
- [x] 실시간 영상 1,258개의 YouTube ID 형식 검증; malformed ID 차단 및 비정상 조회수 처리 추가
- [x] 기본 브라우저 보안 헤더와 모달 키보드 포커스 트랩 보강
- [x] 저장소에서 생성된 Cloudflare 로컬 메타데이터 제거 및 로컬 Secret/cache ignore 회귀 테스트
- [x] Google 저장소 계정 전환/로딩 실패 시 이전 사용자 데이터가 보이지 않도록 보완하고 저장 링크 호스트·HTTPS allowlist 검증
- [x] 저장소 API 401/네트워크 실패 시 기기 저장 데이터를 지우지 않고 로그인 재시도/동기화 재시도 안내
- [x] OAuth callback 쿼리만으로 로그인 성공을 알리지 않고, 인증된 Drive 읽기 성공 후에만 확인 표시
- [x] 브라우저 피드 데이터의 가수·YouTube ID·영상 분류를 allowlist로 정화해 DOM class 주입과 malformed URL 차단
- [x] API 기반 팬 댓글의 이름·본문 HTML 이스케이프와 YouTube 댓글 메타데이터의 숫자 정화 검증
- [x] 라이브 랭킹 API 점수를 안전 정수·등록 가수로 제한해 삽입된 HTML·임의 가수 키 주입 차단
- [x] 네이버·기사·SNS 결과 링크는 credential-free HTTPS만 클릭 가능하게 렌더링
- [x] 브라우저 블로그 렌더링에서도 Naver 도메인만 허용해 백엔드 링크 검사와 중첩 검증
- [x] 가수 전환/상세 모달 닫기 뒤 늦게 도착한 콘텐츠·댓글 API 응답이 새 화면을 덮지 않도록 요청 대상을 재검증
- [x] 기능에 맞게 개인정보처리방침·이용약관 초안 및 운영 설정 안내 갱신
- [x] 검증되지 않은 로그 1년 보관/댓글 삭제 단정 문구를 개인정보 안내에서 제거하고 실제 설정 미확인 상태를 명시
- [ ] 개인정보 공지의 정확성 확정: 계정·댓글·로그의 실제 보유기간/처리위탁을 POMYJO API 설정과 대조하고, 공통 POMYJO 방침(로그인·서버 동기화 관련 설명 포함)과 최애광장 기능 안내의 적용 범위를 운영자와 확인
- [ ] Cloudflare Preview에서 API Secrets 등록 후 Naver/YouTube 실연동 확인
- [ ] Cloudflare에서 Preview 배포·Secret 범위를 확인하고 API Secret을 안전하게 등록; Wrangler의 현재 Production Secret 목록은 비어 있음
- [ ] 현재 Production 배포 확인: `/blogs.html`이 신규 검색결과 페이지 대신 이전 홈 HTML을 반환하고 `/api/blog`, `/api/popular-videos`도 JSON 대신 HTML fallback을 반환; Preview 배포 후 재검증
- [ ] POMYJO API의 Google OAuth 세션 쿠키를 브라우저 요청에 전달하고 choeae-plaza origin에 credentialed CORS 허용 (현재 공개 API의 미인증 GET은 401, OPTIONS에 `Access-Control-Allow-Credentials` 없음)
- [x] 320px·375px 모바일과 데스크톱 브라우저 스모크·레이아웃·키보드 포커스 확인(외부 API/플레이어는 모킹)
- [x] 320px 모바일 상단에서 브랜드·계정·글자 크기 조절이 겹치던 문제를 줄바꿈 레이아웃으로 수정하고 버튼 터치 영역 44px 확인
- [x] Axe 대비 점검에서 발견된 네이버 공유 버튼·보조 문구·대표곡 링크·다크 모드 계정 버튼 문제를 수정하고 라이트/다크 홈·가수 상세 및 약관 페이지 위반 0건 확인
- [x] 개인정보처리방침·이용약관에 main 랜드마크를 추가하고 Axe에서 두 페이지 위반 0건 확인
- [x] 브라우저 스모크와 라이트/다크 Axe 접근성 점검을 재현 가능한 Playwright CI 테스트로 고정
- [x] 네이버 전용 검색결과 페이지도 Axe 위반 0건, 320/375px·데스크톱 가로 넘침 없음, 출처 링크 터치영역 확인
- [ ] Google 로그인 및 Drive 저장/재로그인 복원 E2E 확인 (backend session/CORS 설정 후)
- [x] GitHub 리뷰 PR 생성
- [x] GitHub Actions에서 Node 회귀 테스트와 Wrangler Pages Functions 번들 빌드 실행
- [x] GitHub Actions 결과 확인 (최신 커밋 CI 통과)
- [x] Wrangler Pages 로컬 런타임과 CI 스모크에서 정적 페이지·보안 헤더·키 누락 응답·noindex 404 확인
- [ ] Cloudflare 배포 Preview 확인 (프로젝트 Git 연동이 꺼져 있고 배포 목록은 Production뿐; 브랜치 Preview 없음)
- [x] 기존 noindex 유지 및 noindex 페이지를 sitemap에서 제외
- [ ] 독창적인 가수별 편집 콘텐츠가 충분해진 뒤 검색/AdSense 준비 여부 재평가

## 외부 의존성 및 한계

- Cloudflare Pages Secrets가 필요: NAVER_API_HUB_CLIENT_ID, NAVER_API_HUB_CLIENT_SECRET, YOUTUBE_API_KEY. 값은 저장소나 채팅에 넣지 않는다. 기존 NAVER_CLIENT_ID/SECRET은 기존 사용자만 제한된 종료 유예기간 중 legacy fallback으로 사용.
- [ ] NAVER Developer Center legacy 인증 fallback은 API 종료일(2027-06-30) 이전에 제거하고 API HUB credentials만 남길 것
- 인기 영상은 전체 YouTube 인기 순위가 아니라 사이트가 수집한 최근 영상 중 조회수 순이다.
- 대표곡 선택은 YouTube Music 검색을 새 탭으로 연다. YouTube Music의 자체 플레이어를 사이트 안에 임의로 임베드하지 않는다.
- 변경사항은 운영 배포 전 사용자/리뷰자의 확인을 거친다.
