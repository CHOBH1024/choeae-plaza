# Google Drive 로그인 모듈 — 운영 반영 전

`google-drive-auth.cjs`는 기존 Express 4 공통 API에 장착할 독립 CommonJS 모듈이다. 추가 npm 의존성 없이 Node 24의 crypto/fetch를 사용한다. **2026-10-08 사용자 승인 후 기존 서버에 적용·재시작했다.** Cloudflare Pages Functions에 배포할 파일은 아니다. 프런트엔드 운영 배포는 변경하지 않았다.

등록 함수에는 `clientId`, `clientSecret`, `redirectUri`, `allowedOrigins`, `defaultOrigin`을 전달한다. 인증정보는 기존 서버의 안전한 설정에서 주입하며 저장소에 기록하지 않는다. Origin은 HTTPS의 정확한 원점만 허용한다. Preview는 개별 배포 URL을 명시적으로 등록하고 Pages 전체 wildcard를 허용하지 않는다.

## 통합 게이트

- 운영 변경 승인 후 원본·서비스 설정을 권한 제한 백업하고 소스 해시를 기록한다.
- 기존 OAuth/Drive 라우트를 **교체**한다. 앞에 있는 기존 라우트가 요청을 먼저 처리하면 이 모듈은 보안 보호를 제공하지 못한다.
- 이 모듈의 OPTIONS 응답이 전역 CORS 미들웨어보다 먼저 처리되도록 등록 순서를 구성한다. 전역 CORS가 먼저 OPTIONS를 종료하면 credentialed CORS가 동작하지 않는다.
- 공통 서비스의 다른 API 경로·Origin·rate limiter를 회귀 점검한다. 로그인 경로는 별도 요청 제한을 적용하고, 제한/본문 파싱 실패 응답의 CORS도 점검한다.
- 프런트엔드 logout을 `POST /auth/logout`에 연결하고, 서버 성공을 확인하기 전에 서버 로그아웃 완료를 표시하지 않는다. 첫 로그인 기기 데이터 병합 정책도 별도 구현한다.
- 구문/회귀 테스트 후 서비스 재시작 및 health 확인. 실제 Google 로그인·Drive 생성/재조회·기존 파일 업데이트·로그아웃 후 인증 거절을 브라우저에서 검증한다.
- 통합 또는 실검증 실패 시 백업 복원/재시작. 정상 작동하는 공통 API를 해치지 않도록 변경 범위를 최소화한다.

## 저장·개인정보 범위

OAuth state는 최대 10분, 세션은 최대 8시간 동안 프로세스 메모리에만 유지한다. 만료 항목은 다음 인증 요청에서 정리한다. 토큰을 DB나 로그에 기록하지 않는다. 서비스 재시작 시 세션이 소실돼 재로그인이 필요하다. 사용자 저장 항목은 Google Drive의 앱 생성 JSON 파일에 저장하며, 서버 로그아웃이 Google 계정 전체 로그아웃이나 Drive 파일 삭제를 뜻하지 않는다.

세션 쿠키는 `__Host-`/Secure/HttpOnly/SameSite=None, state 쿠키는 Lax다. Preview에서 브라우저의 서드파티 쿠키 차단에 영향을 받을 수 있다. 쿠키 보호를 완화해 우회하지 말고 실제 운영 도메인에서도 검증한다. 이 설명은 준비한 모듈의 설계이며 **현재 운영 개인정보 방침의 사실 확정 근거가 아니다.**

## 적용 및 확인 결과 (2026-10-08)

- 원본 소스와 systemd 설정을 root 전용 0700 백업 디렉터리/0600 파일로 보관. 후보 소스와 모듈 구문 검사 후 원자적으로 소스를 교체했다. 원본의 인증정보는 서버 안에서만 유지했고 Git으로 복사하지 않았다.
- 전용 인증 라우트/정확한 CORS/요청 제한을 공통 CORS 앞에 배치하고 기존 OAuth/Drive 라우트를 제거. Caddy의 loopback 프록시만 신뢰한다.
- 서버에 설치된 실제 Express로 `runtime-integration.cjs` 실행 성공. Google 응답은 모킹하고 localhost의 임시 포트에서만 state·소유권·CORS·Drive 생성/수정/읽기·로그아웃 검증.
- 재시작 후 외부 `/api/health`, 공개 가수 피드·인기 API는 200. 미인증 Drive/세션은 401, 잘못된 OAuth state는 400. 운영 및 등록 Preview preflight는 204/credential 허용, 미등록 Origin은 403.
- 실제 Google 재로그인에서 기존 허용 권한을 확인한 후 callback이 Preview로 복귀했다. 그러나 Drive 동기화 성공은 확인되지 않았다. 브라우저가 세션 API 직접 탐색을 `ERR_BLOCKED_BY_CLIENT`로 차단했으며, 이를 우회하거나 인증 쿠키를 외부 도구로 옮기지 않았다. **전체 로그인·Drive E2E 완료는 아니다.**
- 모듈 SHA-256: `c35b9fdf33e6a6da751b7a9dc3f3c6036d32d3547eaf48d1cf88a3af049f3ba1`.
- 적용된 서버 소스 SHA-256: `d54ece33bf3ca8359e22c5d31d81244596d25f7f1d72dba526e87abbb3802e0b`.

`apply-auth-patch.py`는 원본 해시 일치 여부를 검사하는 **일회성** 도구다. 적용 후 다시 실행하면 해시 검사에서 멈춘다. 파일 변경만 수행하고 서비스 재시작은 하지 않는다. 서버 경로와 대상 해시가 다른 환경에 그대로 실행하지 않는다.

## 테스트 및 근거

`npm test`에 포함된 테스트는 fake Express 라우터·fake Google 응답으로 state/PKCE, 인증 누락·계정 변조, 정확한 CORS, 세션 만료/로그아웃, 토큰 갱신, 동시 저장, multipart 생성, 실패 처리와 페이로드 검증을 확인한다. 실제 Express 미들웨어 순서·실 OAuth·Drive 권한 동의는 통합 후 추가 검증해야 한다.

- [Google OAuth 웹 서버 흐름](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Drive multipart 업로드](https://developers.google.com/workspace/drive/api/guides/manage-uploads)

## 중복 저장 파일 복구 및 Preview (2026-10-08)

안전한 고정 오류 코드만 남기는 진단에서 실제 실패 원인이 `DRIVE_FILE_CONFLICT`임을 확인했다. Google Drive API는 이미 활성화되어 있었다. 기존 동일 이름 파일은 삭제하거나 임의로 하나를 고르지 않는다. 최대 20개의 기존 파일을 읽어 중복 항목을 합쳐 표시하고, 성공적으로 읽은 세션에서만 새 `appProperties.choeaePlazaStore=v1` 표준 파일을 생성한다. 이후 저장은 표준 파일만 갱신한다. 표준 파일 자체가 여러 개인 경우에는 계속 실패 처리한다. 200개/크기 제한을 넘으면 조용히 잘라 저장하지 않는다.

복구 모듈은 이전 두 버전을 root 전용 백업한 뒤 원자 교체했다. 실제 Express 통합 테스트 및 재시작 후 health가 정상이다. 실제 Google 재로그인 뒤 이전 Preview에서 서버 동기화 실패 안내 없이 저장소 화면이 나타났으며 과거 프런트 화면은 0개로 표시됐다. 최신 Preview에서는 기존 항목 5개가 표시됐고 실제 저장 성공 및 새로고침 후 5개 재조회(복구 안내 없음)를 확인했다. 이전 화면의 0개를 서버의 빈 저장 결과로 간주하지 않는다.

최신 프런트엔드는 서버 성공을 확인하는 logout, 실패 시 기기 상태 보존, 복구 안내 및 등록된 고정 Preview callback을 포함한다. Node 65개와 모킹 브라우저 스모크(320/375px, 데스크톱, light/dark axe)가 통과했다. Preview: https://codex-finish-choeae-plaza.choeae-plaza.pages.dev (배포 9b288f40). 운영 프런트엔드는 아직 배포하지 않았다. 첫 로그인 기기 항목 보존과 실제 계정 저장/복원은 남은 게이트다.

### 실제 계정 E2E 최종 확인 (최신 Preview)

Google 기존 권한 재로그인 → 기존 항목 5개 복구 → 지금 저장 성공 → 새로고침/서버 재조회 5개 → 서버 logout 성공/기기 화면 0개 → 동일 계정 재로그인/서버 읽기 5개를 확인했다. 표준 파일 재조회에서는 기존 파일 병합 안내가 사라졌고 동기화 실패 안내도 없었다. 원본 Drive 파일 삭제는 수행하지 않았다. 실제 E2E는 해당 계정/Preview의 확인 범위이며 운영 프런트엔드 배포 또는 별도 계정 전환 테스트를 뜻하지 않는다. 첫 로그인 기기 항목 보존과 개인정보 대조, 최종 운영 감사는 여전히 남아 있다.
