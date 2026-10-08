# Instagram 공식 연동 준비

2026-10-08 Meta 개발자 대시보드에서 최애광장 앱 생성 완료를 확인했다. 앱 ID는 `2267982294049000`, 앱 연락처는 `malrang1024@gmail.com`이다. 실계정 승인·토큰 등록·실제 게시물 수신은 아직 완료되지 않았다. 검색 링크를 게시물 API 수집 완료로 설명하지 않는다. Google 로그인은 최애 저장용이며 Instagram 계정 권한을 부여하지 않는다.

## 실제 대시보드 확인 기록 (2026-10-08)
- 사용자 약관 동의 승인과 직접 보안 재인증 후 앱 대시보드 진입을 확인했다. 앱은 게시하지 않았다.
- Instagram API 이용 사례에 `Facebook 로그인이 포함된 API 설정` 경로가 제공된다. 운영자 Instagram 프로페셔널 계정과 Facebook 페이지 연결이 필요하다고 화면에 안내된다.
- 일괄 콘텐츠 권한 추가 버튼에는 게시 권한도 포함되어 있어 사용하지 않았다. 메시지 권한 추가 버튼도 사용하지 않았다.
- 사용자 실행 시점 승인 후 개별 목록에서 `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list` 4개를 추가했다. 각 권한의 상태 `테스트 준비 완료`, API 호출 수 0을 확인했다. 게시·DM 권한은 여전히 미추가다. 이는 앱 권한 설정이며 실계정 동의·고급 액세스 승인·API 호출 성공이 아니다. 계정 연결 및 토큰 발급은 별도 승인·검증 대상이다.
- 비즈니스 포트폴리오는 연결하지 않았다. 실제 운영 공개에 필요한 비즈니스 인증·앱 검수·고급 액세스 요건은 계속 검증해야 한다.

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

`/api/instagram?name=...`은 허용 가수만 받으며 고정 graph.facebook.com에 Bearer header로 요청한다. 최대 6개 공개 게시물 metadata와 계정 출처가 붙은 본문 미리보기(최대 240자)를 반환한다. 전문을 복제하지 않으며 캐시·DM·로그 저장을 하지 않는다. 본문은 HTML로 실행하지 않고 원문 문자열을 이스케이프해 표시한다. 계정·스키마·URL 검증과8초 timeout, 원문 permalink 연결을 사용한다. Workers 호환 redirect:manual로 요청하고3xx를 포함한 비-2xx를 거절해 Bearer Secret이 다른 origin으로 전달되지 않게 한다. 현재 UI는 원문 링크를 제공하며 자동 embed/Instagram 미디어 재생을 구현한 것으로 설명하지 않는다.

연결 검증: 실제 승인 계정으로200응답/username/원문 일치/권한 만료·503상태/다른 가수 늦은 응답 무시를 확인한다. 승인 없이 Production Secret이나 접근권한을 확대하지 않는다. 프런트엔드/개인정보 고지와 Meta 앱의 URL·처리 범위를 함께 검토한 뒤 공개한다.

공식 근거: [Meta 운영 Instagram API 문서](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf), [Meta Business Discovery](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery/). Meta 문서 직접 조회는429로 제한되어 실제 계정 설정 때 다시 확인해야 한다. 엔드포인트 구현의 모킹 성공은 공식 권한 승인/실제 API 성공을 대신하지 않는다.

## 현재 미연결 원인과 수정 (2026-10-08)

2026-10-09에도 운영 API503/`INSTAGRAM_NOT_CONFIGURED`와 실제 에스파 상세의 미연결 안내를 확인했다. 기존 Meta 앱의 읽기 권한4개는 여전히 테스트 준비 완료·호출0이다. ‘Facebook 로그인이 포함된 API 설정’ 화면은 프로페셔널 계정을 Facebook 페이지에 연결한 후 비즈니스용 Facebook 로그인으로 앱 권한을 부여하라고 안내한다. 이번 확인은 읽기와 화면 탐색뿐이며 권한·토큰·계정 연결·공개를 변경하지 않았다. 공식 문서 직접 조회는 계속429여서 실제 설정 화면과 구현 상태를 근거로 기록한다.

운영 API에서 `INSTAGRAM_NOT_CONFIGURED`를 다시 확인했다. 운영자 계정·승인 토큰·Graph 버전이 없는 상태에서 페이스북 브라우저 로그인만으로 서버 호출을 할 수는 없다. 개발자 앱 생성과 읽기 권한 등록은 이미 했지만 실제 프로페셔널 Instagram 계정, Facebook 페이지 연결 및 서버 Secret 등록이 남았다. 사용자에게 연결할 운영 계정의 유무를 질문했으며 답변을 기다린다. 비밀번호나 토큰을 채팅으로 요구하지 않는다.

`58a9808` 변경은 caption 필드를 요청하고 짧은 원문 미리보기와 계정·원문 링크를 표시한다. 사이트 전체의 연결 미완료와 특정 가수 계정 매핑 누락도 구분한다. 이는 코드 변경이며 실제 API 성공을 의미하지 않는다. Meta 공식 문서상 이 Facebook Login 경로는 페이지에 연결된 프로페셔널 계정을 요구하며 일반 개인 계정을 조회하지 못한다. 연결 후 실제 200 응답을 확인하기 전에는 자동 수집 완료라고 안내하지 않는다.
