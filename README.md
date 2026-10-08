# 최애광장

트로트·아이돌별 YouTube 영상, YouTube Music 검색, 네이버 블로그 검색으로 이동할 수 있는 정적 웹앱입니다. Cloudflare Pages Functions를 사용합니다.

네이버 검색 API 약관에 따라 네이버 결과는 광고 스크립트가 없는 별도 noindex 페이지(`/blogs.html`)에서만 독립적으로 표시하고, 출처 링크를 제공합니다. 검색 결과를 앱의 Drive 저장 기능으로 복사하지 않으며 API 응답은 캐시하지 않습니다. 이 구현을 운영 사용 전에 API 등록 계정의 적용 약관과 최신 정책에 대조하세요.

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

브라우저는 Google 로그인 후 POMYJO API에 저장소를 읽고 씁니다. 프런트엔드 요청은 세션 쿠키를 포함하지만, API는 `https://choeae-plaza.pomyjo.com`에 대해 정확한 `Access-Control-Allow-Origin`과 `Access-Control-Allow-Credentials: true`를 반환해야 하며 OAuth 콜백은 보안 쿠키 세션을 설정해야 합니다. 현재 공개 API 점검에서는 미인증 저장소 요청이 401을 반환했고 CORS preflight에서 credential 허용 헤더가 확인되지 않아, backend 설정 확인 전에는 로그인/Drive 동기화가 검증된 기능으로 간주하지 않습니다. 쿠키·API 인증 검증 없이 `user` 파라미터를 신뢰하지 마세요.

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
- Google 로그인/Drive 세션·저장 복원은 아직 실검증되지 않음. 기존 noindex 및 운영 배포는 변경하지 않음.
