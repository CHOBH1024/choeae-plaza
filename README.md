# 최애광장

트로트·아이돌별 YouTube 영상, YouTube Music 검색, 네이버 블로그 검색으로 이동할 수 있는 정적 웹앱입니다. Cloudflare Pages Functions를 사용합니다.

네이버 검색 API 약관에 따라 네이버 결과는 광고 스크립트가 없는 별도 noindex 페이지(`/blogs.html`)에서만 독립적으로 표시하고, 출처 링크를 제공합니다. 검색 결과를 앱의 Drive 저장 기능으로 복사하지 않으며 API 응답은 캐시하지 않습니다. 이 구현을 운영 사용 전에 API 등록 계정의 적용 약관과 최신 정책에 대조하세요.

## 현재 검토 상태 (2026-10-08)

- 최신 기능 Preview: https://f7e43a29.choeae-plaza.pages.dev/?view=idol (구현 `bf5df72`); 고정 alias는 이후 Preview 배포 시 갱신됩니다. 리뷰 PR: https://github.com/CHOBH1024/choeae-plaza/pull/1 . Production은 별도 검토/승인 대상입니다.
- 디자인: PC 검색 헤더/라이브러리 사이드바, 모바일 단일 헤더/하단 아이콘 탐색/표지 선반/전면 아티스트 상세. 기기 최근 본 영상/최애 선택,13px 이상 핵심 글씨/44px 터치,세로·짧은 가로 재생기. 트로트 큰글씨는 분리 유지.
- 광고·화보: `/api/showcase?name=BTS&kind=campaign` 또는 `kind=editorial`로 광고 영상·화보 메이킹을 최신순으로 검색합니다. 메뉴가 보일 때 조회하며 한 번의 검색에서 최대24개 후보 중 이름을 확인한 최대8건을 표시하고,15분 캐시/8초 상한을 적용합니다. BTS는 방탄소년단으로 검색합니다. 제목·채널의 등록명·일부 별칭을 확인하고, 짧은 멤버명은 설명의 그룹명과 함께 판단합니다. 설명의 홍보 태그만으로는 포함하지 않습니다. 다른 표기는 누락될 수 있습니다. 재생·목록 저장·원문 링크와 실패 시 재시도를 제공하고, 공식 콘텐츠·아티스트 일치를 인증하지 않습니다. 원본 화보 사진은 복제하지 않으며 매거진 원문은 외부 검색으로 연결합니다.
- 자동 직캠: `/api/fancams?name=BTS` 공식 YouTube 최신순 키워드 검색, 최대8건/15분 캐시/8초 상한, 서버 Secret만 사용. 검색이 아티스트 일치·직캠 종류·공식 업로드를 인증하지 않습니다. 실제 API200과 클립 재생/일시정지 표본을 검증했습니다.
- PWA: Apple Safari/Android Chrome 홈 화면 추가 안내, 지원 브라우저의 사용자 선택 설치. 강제 다운로드·스토어 앱·오프라인 영상이 아닙니다. 세션/API 응답을 SW에 저장하지 않습니다.
- 언어: 한국어·간체 중국어·일본어·영어·스페인어·프랑스어. CF 국가 기본값/브라우저 보완과 기기 수동 선택. 주요 탐색·검색·최애 빈 상태·아이돌 소개·설치 안내를 번역하며 **전체 UI 번역은 진행 중**입니다. 외부 제목·가수명은 원문입니다. `public/locale-copy.js`의 key별6개 문자열과 `data-i18n`이 소유 UI만 대상으로 합니다.
- 추가 자동 검색·고지 문구·언어와 카드의 반복 갱신 방지를 포함해 Node144개 통과, 의존성 취약점0, Functions 빌드를 확인했습니다. 코드 `bf5df72`의 [원격 CI](https://github.com/CHOBH1024/choeae-plaza/actions/runs/37757490857)는 전체 통과했습니다. 배포 확인과 검사 범위는 [RELEASE_REVIEW.md](RELEASE_REVIEW.md)에 기록합니다. 자동 브라우저와 workerd 검사는 공급자 fixture를 사용하며 실제 계정 연동 증거와 구분합니다.
- 문의: malrang1024@gmail.com. 소개·콘텐츠 운영 기준과 광고 쿠키·거부 안내를 보완했습니다. [애드센스 점검과 Dataset 경고](ADSENSE_REVIEW.md)에서 운영/검토 버전 차이와 미완료 항목을 확인하세요. 기존 noindex/AdSense 유지. 검색 유입·광고 승인·90점 달성을 보장하지 않습니다.

## API 환경변수

연동 기능을 켜려면 Cloudflare 대시보드의 Workers & Pages → choeae-plaza → Settings → Variables and Secrets에서 아래 키를 Secret 타입으로 등록하세요. Preview와 Production 환경을 각각 설정해야 합니다.

| Secret 이름 | 용도 |
| --- | --- |
| NAVER_API_HUB_CLIENT_ID | NAVER API HUB Client ID |
| NAVER_API_HUB_CLIENT_SECRET | NAVER API HUB Client Secret |
| YOUTUBE_API_KEY | YouTube Data API v3 키 |

키를 HTML/JavaScript에 넣거나 GitHub에 커밋하지 마세요. 키가 없으면 페이지는 동작하며 검색 결과 대신 안내와 외부 검색 링크를 보여줍니다.
외부 검색 API 요청은 8초 제한시간을 두며, 제한시간 초과 시 임시 오류 응답을 반환합니다.
네이버 검색 연동은 NAVER API HUB 키를 기본 사용합니다. NAVER Developers Center에서 Search API 신규 신청은 2026-07-31 종료됐고, 기존 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` 키만 제한된 마이그레이션 fallback으로 지원합니다. 기존 Developer Center Search API도 2027-06-30 종료 예정이며, 그 키는 API HUB 호출에 쓸 수 없습니다. NCP 콘솔에서 NAVER API HUB Application과 검색 API를 등록하고 새 키로 교체하세요. 새 키가 일부만 설정되면 보안상 legacy로 fallback하지 않고 설정 오류를 반환합니다. [API HUB 이관 가이드](https://guide.ncloud-docs.com/docs/apihub-migration)와 [서비스 이관 일정 공지](https://developers.naver.com/notice/article/32530)를 참고하세요.
Google Cloud에서 YouTube Data API v3를 활성화하고 API 키 사용을 해당 API로 제한한 뒤, Cloudflare Secret에 등록하세요.
로컬 Pages Functions에서만 Secret이 필요하면 `.dev.vars.example`을 `.dev.vars`로 복사하고 실제 값으로 바꾸세요. `.dev.vars`는 Git에서 무시되고 예시 파일만 추적됩니다. 실제 Secret 값을 저장소나 채팅에 붙여 넣지 마세요.

## Google 저장소 API 연동 주의

댓글·보유기간 운영 도구와 남은 적용 게이트는 [개인정보 요청 처리 운영안](backend/PRIVACY_OPERATIONS.md)을 참조하세요. `comment-request-audit.py`와 `retention-audit.py`는 기존 Python 3의 표준 SQLite를 사용하며 읽기 전용입니다. 개인정보를 출력하거나 기존 데이터를 삭제하는 도구가 아닙니다. 별도의 `retention-job.py`도 기본은 읽기 전용이지만, `--apply`는 기간 초과 기록을 영구 삭제합니다. 후보 timer/service는 미설치이며, 구체적인 실행 승인 전에는 활성화하지 않습니다. 기간 선택을 삭제 실행 승인으로 간주하지 마세요.

브라우저는 Google 로그인 후 POMYJO API에 저장소를 읽고 씁니다. 승인된 backend 수정으로 정확한 Origin allowlist와 credentialed CORS, OAuth state/PKCE, Secure·HttpOnly 세션 쿠키, 계정 소유권 검사 및 서버 logout을 적용했습니다. 미인증 요청은 401, 미등록 Origin은 403으로 거절합니다. 고정 Preview에서 실제 계정의 기존 5개 항목 읽기→저장→재조회→서버 logout→동일 계정 재로그인 복원을 확인했습니다. 별도 실제 계정 전환과 신규 기기 가져오기 전체 흐름은 이 증거의 범위가 아니며, 계정 격리/실패 보존은 단위·모킹 브라우저 테스트로 추가 검증했습니다. 쿠키·API 인증 검증 없이 `user` 파라미터를 신뢰하지 마세요.

POMYJO 공통 개인정보처리방침(https://pomyjo.com/privacy)은 pomyjo.com과 직접 운영 페이지의 범위를 설명하고 연결된 도구마다 처리 방식이 다를 수 있다고 안내합니다. 해당 방침은 선택적 Google 로그인을 설명하면서 서버 동기화는 아직 제공하지 않는다고도 적고 있지만, 최애광장은 저장 동기화·댓글 API를 호출합니다. 따라서 이 사이트의 실제 API 처리·보유기간·삭제 절차를 운영 설정과 대조하기 전에는 개인정보 고지가 확정됐다고 판단하지 않습니다.

## 배포 후 확인

- /api/blog?name=임영웅 — 네이버 블로그 검색 결과
- /api/popular-videos?name=임영웅 — 최근 수집 영상 중 조회수 상위 결과

회귀 테스트는 `npm ci` 후 `npm test`로 실행합니다. 브라우저 설치까지 끝난 환경에서는 `npm run test:browser -- http://127.0.0.1:8788`로 콘텐츠·모바일·키보드·라이트/다크 접근성 스모크를 추가 실행할 수 있습니다. CI는 Pages 로컬 런타임 스모크와 이 브라우저 검증을 함께 수행합니다.

## 로컬 Pages Functions 검증

Cloudflare에 배포하지 않고 정적 페이지와 Functions를 함께 실행하려면 최신 Wrangler로 다음을 실행하세요:

```sh
npx --yes wrangler@latest pages dev public --port 8788
```

브라우저에서 `http://127.0.0.1:8788/`을 열고 API 응답은 `/api/blog?name=임영웅`, `/api/popular-videos?name=임영웅`에서 확인할 수 있습니다. Secret이 없는 상태에서는 두 라우트가 JSON `503`을 반환하며, 이는 Functions가 로드되고 키 누락을 안전하게 처리하는 정상 동작입니다. 실제 검색 결과를 검증하려면 `.dev.vars.example`을 `.dev.vars`로 복사한 뒤 키를 넣으세요. 실제 `.dev.vars`는 Git에서 무시되고 값은 저장소나 채팅에 공유하지 마세요. 이 명령은 로컬 서버만 실행하고 Cloudflare Preview나 Production에 배포하지 않습니다.

인기 영상은 YouTube 전체 순위가 아니라 사이트의 최근 영상 피드에서 조회수를 비교한 결과입니다. 대표곡을 누르면 YouTube Music 검색 페이지가 새 탭으로 열립니다. 외부 API 변경이나 할당량 제한으로 데이터가 비어 있을 수 있습니다.

## 콘텐츠 및 검색 노출

검색 결과는 원문 제목·요약과 원문 링크로 제공하며, 블로그 글 전문을 복제하지 않습니다. 가수별 페이지는 독창적인 편집 콘텐츠가 충분해질 때까지 색인을 막는 기존 noindex 정책을 유지합니다. 색인/광고 설정은 원본 콘텐츠와 개인정보·광고 정책을 함께 점검한 뒤 변경하세요.

## 연결 작업에 사용할 운영 리소스

- Cloudflare Pages: `choeae-plaza`, 운영 브랜치 `main`. 수정 검증은 `codex/finish-choeae-plaza` Preview에서 진행.
- Google Cloud: `POMYJO Choeae Plaza`, 프로젝트 ID `skilful-grammar-511023-c8`. 기존 ETF 프로젝트와 분리. YouTube Data API v3 활성화 및 해당 API만 허용한 전용 Preview 키 발급 완료. 결제 설정은 변경하지 않음.
- NAVER Developers: 기존 `최애광장` 검색 앱의 인증정보가 존재함을 브라우저에서 확인. 실제 값은 문서·소스·채팅에 기록하지 않음. API HUB 키와는 다른 legacy 인증정보로, 서비스 이관 일정에 따라 교체가 필요.
- 인증정보 발견은 연결 완료가 아님. Preview Secret 등록 뒤 블로그 실제 검색과 영상 조회수 API를 확인하고, Google 계정 로그인/저장 복원은 POMYJO backend 세션과 CORS를 별도로 검증해야 함.

## 실제 외부 연동 검증 (2026-10-08)

- Preview에만 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `YOUTUBE_API_KEY`를 암호화 등록. Cloudflare 프로젝트 API로 Production 환경변수는 비어 있고 Preview에만 세 이름이 있음을 확인. 실제 키 값은 파일이나 Git에 기록하지 않음.
- `https://a4ebc7c8.choeae-plaza.pages.dev/api/blog?name=임영웅`: HTTP 200, 실제 검색 결과 8건, `Cache-Control: no-store`.
- 같은 Preview의 `/api/popular-videos?name=임영웅`: HTTP 200, 최근 수집 영상 중 조회수 상위 5건, 실제 YouTube 제목·채널·조회수 확인.
- 네이버 검색은 네이버 호스팅 블로그만이 아니라 티스토리 등 외부 블로그도 반환. 기존 호스트 제한 때문에 실제 결과가 모두 버려지던 문제를 수정하고 출처 도메인을 표시. 외부 원문은 HTTPS만 허용하고, 인증정보·포트·로컬 주소·실행형 URL은 차단. 네이버의 문서화된 HTTP 링크만 예외 유지.
- 별도 광고 없는 `/blogs` 화면에서 실제 8건의 렌더링 확인. 잘못된 upstream 스키마를 빈 검색결과 성공으로 처리하지 않도록 수정.
- Google 로그인/Drive의 이후 실제 검증 결과는 위 Google 저장소 API 절 참조. 기존 noindex 및 운영 프런트엔드 배포는 변경하지 않음.

### 검색 정렬과 일시 오류 복구

블로그 화면은 최신순을 기본 선택하며, 정확도순으로 변경할 수 있습니다. 선택은 URL에 남아 새로고침 후에도 유지됩니다. API는 `sort=date` 또는 `sort=sim`만 허용하며, 기존 클라이언트를 위해 정렬 파라미터가 없는 API 호출은 정확도순을 유지합니다. 최신순은 네이버가 제공한 작성일 순서이며 모든 글의 관련성·내용을 보증하지 않습니다.

2026-10-08 Preview `https://ec13398c.choeae-plaza.pages.dev`의 실제 검색에서 최신순 8건 모두 `postdate=20261008`, 정확도순 8건은 과거 글로 확인했습니다. 가수 상세에서는 모킹 없이 실제 최근 영상·조회수·기사의 렌더링을 확인했습니다. 키 미설정과 일시적인 조회수 API 오류를 구분하며 후자에는 다시 불러오기 버튼을 제공합니다. Node 50개 테스트 및 정렬 선택/새로고침·502→재시도→정상 표시를 포함한 모바일/데스크톱 브라우저 스모크가 통과했습니다. 플레이어 재생·음악 외부 이동의 자동 검증은 여전히 모킹을 사용하며 실제 계정 로그인 성공을 증명하지 않습니다.

## 감상 안내 편집

`data/artist-guides.json`은 개별 감상 안내의 원본이며 `node scripts/generate-guides.mjs`가 홈에서 사용하는 `public/artist-guides.js`를 생성합니다. `npm test`가 두 파일의 일치·출처·자료 확인일·본문 정화를 검사합니다. 가수 랜딩은 동일 JSON을 서버에서 읽습니다. 안내의 감상 경로는 편집 의견이고 곡명/공개 버전 확인 출처는 페이지에 표시됩니다. 가사, 외부 블로그 글, Naver 응답을 복사하여 편집 글로 만들지 않습니다. 안내가 없는 가수에 대해 임의로 글을 생성하거나 공식 추천/인기 순위로 표시하지 않습니다.

## 아이돌 뮤직 화면 (2026-10-08)

`/?view=idol` 또는 상단 ‘아이돌 뮤직’으로 음악 탐색형 화면을 엽니다. 큰글씨 광장은 그대로 유지하며 기존 로그인·보관함·API를 공유합니다. 어두운 배경/민트 포인트, 데스크톱 탐색 메뉴, 정사각형 영상 미리보기, 아이돌·팝 대표곡 모음을 제공합니다. Spotify API 연동이나 앨범 커버/실시간 순위 제공을 의미하지 않습니다. 표지는 기존 최근 영상의 썸네일이며 실패 시 기본 카드와 재시도를 표시합니다. 사용자 테마 선택과 보관함 데이터를 덮어쓰지 않습니다.

검증: `npm test` 98/98, `npm run test:music-hub` (320/375/768/1024/1440px, 밝게/어둡게, 큰글씨, 상세/음악/보관함, 화면 전환/새로고침, 접근성), 기존 `npm run test:browser` 모두 통과. 외부 API와 이미지 요청은 자동 브라우저 테스트에서 모킹하므로 실제 외부 표지 수신을 증명하지 않습니다. Production 배포·Secrets 및 정기 삭제 활성화는 변경하지 않습니다.

## 아이돌 음악 허브 v2 — PC/모바일 분리 (2026-10-08)
- PC: 좌측 탐색, 검색 중심 상단, 최근 영상 카드 선반과 나의 최애 컬렉션. 모바일: 상단 검색, 스와이프 카드, safe-area 하단 탐색.
- 트로트·큰글씨에만 글자 크기 조절 UI 유지. 아이돌은 기본 글씨와 팬 친화 문구를 쓰며 트로트 글씨 저장값을 덮어쓰지 않음. 기기 최애 선택은 로그인 없이 가능, Google 연결 시 기존 계정 저장소 사용.
- 수집 영상 목록은 아이돌 화면이 보이고 온라인인 동안 5분마다 다시 조회. 조회 시각은 브라우저가 받은 시각이며 외부 수집 서버의 새 영상 수집 시각/즉시 반영을 보장하지 않음.
- YouTube 조회수 순위는 최근 수집 최대15개 중 상위5개, 캐시를6시간에서5분으로 조정하고 API 생성시각/범위를 표시. 곡은 기존 YouTube Music 검색 연결이며 무제한 음악 스트리밍 API가 아님. 기존 feed의 직캠 필터와 별도로 최신 직캠 키워드 자동 검색을 제공하며, 각 범위/한계를 구분함. Naver 결과 별도 무광고 페이지/no-store 원칙 유지.
- 문의 메일은 홈/개인정보/약관/감상안내와 메일 링크 모두 malrang1024@gmail.com.
- Node102개, 음악 허브5개폭/양테마/뉴스/팬라운지/보관함/기기최애저장·새로고침/접근성 및 기존 브라우저 회귀 통과. 동작 모킹과 실제 외부 API 확인을 구분.
- Windows 통합 UI 실행: node scripts/local-ui-check.mjs <설치된 Wrangler CLI 절대경로>. 외부 계정 쿠키를 가져오지 않는 별도 테스트 브라우저 사용.

## Instagram 연동 준비 (미연결)
`INSTAGRAM_SETUP.md`의 운영자 Meta 앱/프로페셔널 계정·공식 가수 계정 매핑·실행 시점 권한 승인 절차를 따릅니다. `/api/instagram` 프록시와 상세 화면의 상태/원문 링크, 실제 Meta 앱2267982294049000과 승인된 읽기 권한4개를 준비했습니다. 운영자 프로 계정/FB페이지 연결·토큰·Secret 등록·실제 게시물 수신은 미완료입니다. Instagram 검색, Google 로그인, 모킹 테스트를 실제 인스타 수집 성공으로 설명하지 않습니다. API는 최대6개 게시물 metadata를 읽고 no-store로 반환하며 token은 Bearer header의 서버 요청에만 사용합니다. 캡션 전재·DM·스토리·전체 개인 계정 수집·자동 embed는 제공하지 않습니다. 실제 연결 후 앱 정책과 개인정보 안내를 다시 검토합니다.
