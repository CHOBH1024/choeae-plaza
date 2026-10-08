# Instagram 공식 연동 준비

현재 Meta 앱 생성·실계정 승인·토큰 등록·실제 게시물 수신은 완료되지 않았다. 검색 링크를 게시물 API 수집 완료로 설명하지 않는다. Google 로그인은 최애 저장용이며 Instagram 계정 권한을 부여하지 않는다.

## 사람이 확인할 단계
1. Meta 개발자 앱 화면에서 운영자 계정으로 로그인하고 개발자 등록/약관은 직접 확인한다. 앱 이름은 최애광장, 문의 메일은 malrang1024@gmail.com. 앱 생성 시 표시되는 실제 use case/product 선택을 확인하며 완료 전 생성됐다고 기록하지 않는다.
2. Facebook Page에 연결된 운영자 소유 Instagram 프로페셔널 계정으로 Facebook Login 기반 Business Discovery 사용 가능 여부를 확인한다. 일반 개인 계정/모든 연예인/스토리/DM을 포괄 수집하는 기능이 아니다.
3. 읽기 목적에 필요한 권한만 검토한다. 게시/댓글 관리/DM 권한은 이 기능에 요청하지 않는다. 앱 리뷰·Advanced Access·Public Content 관련 요구는 실제 Meta 대시보드에서 확인한다. 새 권한 부여와 약관 동의는 실행 시점 승인을 받는다.
4. 공식 소속사·아티스트 안내로 확인한 Instagram username만 가수별 매핑에 등록한다. 검색으로 발견한 계정을 공식 계정이라고 임의 표시하지 않는다.

## 서버 설정 (Preview에서 먼저)
- `META_ACCESS_TOKEN`: 서버 Secret. 채팅/소스/URL/log에 넣지 않는다.
- `META_IG_USER_ID`: 권한을 승인한 운영자 프로페셔널 계정 ID.
- `META_GRAPH_VERSION`: 앱에서 지원·확인한 버전을 명시한다. 임의 최신 버전으로 추정하지 않는다.
- `INSTAGRAM_ARTIST_ACCOUNTS`: 검증된 기존 가수명→Instagram username JSON 매핑. 코드에는 실제 계정 목록·토큰을 포함하지 않았다.

`/api/instagram?name=...`은 허용 가수만 받으며 고정 graph.facebook.com에 Bearer header로 요청한다. 최대6개 공개 게시물 metadata를 반환하고 캐시/본문 재게시/DM/로그 저장을 하지 않는다. 계정·스키마·URL 검증과8초 timeout, 원문 permalink 연결을 사용한다. 현재 UI는 원문 링크를 제공하며 자동 embed/Instagram 미디어 재생을 구현한 것으로 설명하지 않는다.

연결 검증: 실제 승인 계정으로200응답/username/원문 일치/권한 만료·503상태/다른 가수 늦은 응답 무시를 확인한다. 승인 없이 Production Secret이나 접근권한을 확대하지 않는다. 프런트엔드/개인정보 고지와 Meta 앱의 URL·처리 범위를 함께 검토한 뒤 공개한다.

공식 근거: [Meta 운영 Instagram API 문서](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf), [Meta Business Discovery](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery/). Meta 문서 직접 조회는429로 제한되어 실제 계정 설정 때 다시 확인해야 한다. 엔드포인트 구현의 모킹 성공은 공식 권한 승인/실제 API 성공을 대신하지 않는다.
