# 검증된 Pages 산출물 배포

GitHub push는 운영 배포가 아니다. 현재 Pages 프로젝트는 Git 연동 대신 직접 업로드를 사용한다. 운영 배포는 사용자가 요청한 범위에서 별도로 실행한다. ETF 루트·Secrets·Meta 권한·광고/색인 설정은 이 절차의 대상이 아니다.

## CI 산출물

Tests workflow는 PR head SHA 또는 push SHA를 명시적으로 checkout한다. Node 검사, 감사, Functions build와 원본 Pages 전체 회귀 후 공식 Wrangler가 생성한 `index.js`와 `_routes.json`으로 별도 stage를 구성한다. 사전 컴파일 stage에서도 같은 전체 회귀를 통과한 경우에만 `verified-pages-bundle`을7일 보존한다.

산출물에는 `_worker.js`, `_routes.json`, `source-sha.txt`, `SHA256SUMS`만 있다. 환경 파일·Secret·로그·전체 Wrangler 작업 폴더는 업로드하지 않는다. 테스트 API는 fixture이며 실제 사용자에게 투표·게시·삭제하지 않는다.

## 배포 전 확인

1. 완료된 CI의 성공 상태와 head SHA를 확인하고 해당 run의 artifact를 내려받는다. workflow의 artifact 보존 성공만으로 운영 반영됐다고 설명하지 않는다.
2. `source-sha.txt`가 배포할 Git HEAD와 같은지, `_worker.js`와 `_routes.json`의 SHA-256이 manifest와 같은지 대조한다.
3. 수정이 없는 해당 checkout에서 `git archive --format=zip --output=<새 경로> <검증 SHA> public`로 공개 파일을 추출한다. Windows `core.autocrlf` 변환이 있을 수 있으므로 checkout 파일을 그대로 복사해 canonical Git 해시와 같다고 가정하지 않는다. 심볼릭 링크·경로 이탈·환경 파일·인증서·키가 있으면 중단한다. 검증된 worker·routes만 추가하며 SHA 파일 등 검증 메타데이터는 웹 자산에 넣지 않는다.
4. Preview를 먼저 업로드해 홈·`/trot`·`/discover`, 실제 API 상태,404/noindex/보안 헤더, JS/CSS 해시와 UI를 확인한다. 외부 서비스의 미연결503을 성공으로 바꾸지 않는다.

공식 CLI의 `pages deploy . --cwd <절대 stage 경로> --project-name choeae-plaza --branch <Preview branch 또는 main> --commit-hash <검증 SHA> --commit-message <검증 기록> --commit-dirty=true --no-bundle`을 사용했다. stage 밖의 파일을 잘못 가리키지 않도록 업로드 대상은 `.`이다. `--commit-dirty=true`는 생성된 stage의 메타데이터 처리용이며 수정된 앱 소스를 검증 없이 배포하라는 뜻이 아니다. SHA 대조와 원본 checkout의 clean 확인은 생략하지 않는다. CI 산출물을 임의 수정하거나 Functions를 생략한 정적 배포로 우회하지 않는다.

## 완료 판정

현재 운영 앱은 `d56b87c7313df44ff0eb7177ca00b9c0d6537664`다. CI37848932919 전체 성공과 공식 bundle의 source-sha·worker/routes SHA-256을 대조하고 정확한 Git public 파일로 stage를 구성했다. Preview b3d9e399 확인 후 같은 stage를 Production0a3c4136에 배포했다. Node216/216, 원본·사전 컴파일 Pages 전체 브라우저 회귀, Pages·사용자 도메인의9개 JS/CSS 해시와3경로200·새 버전·광고 분리·noindex·404·API 미설정 상태·실제 모바일 화면을 확인했다. 상세는 RELEASE_REVIEW.md 최신 기록을 따른다.

양 배포는 package name/version을 확인한 공식 Wrangler4.148.0의 npm-cache CLI를 Node로 직접 실행했다. `--no-bundle`로 성공한 Linux CI 산출물을 그대로 사용했으며 Windows Functions 빌드 실패를 정적 사이트로 우회하지 않았다. Secrets·Meta 권한·기존 데이터·광고/색인 설정·ETF 루트는 변경하지 않았다. 앱 배포 이후 문서 커밋은 다시 앱을 배포한 것이 아니다. 아래 기록은 이전 배포 이력이다.

2026-10-09 최신 앱은 `2f9bf42c6ce47bd42c19409a37980d747e979a84`다. CI37826279673 성공 후 source-sha와 worker·routes SHA256을 대조한 public-only stage로 Preview f9214a2a를 검증하고 Production d05e77c9에 반영했다. Node203/203과 원본·사전 컴파일 Pages 양쪽의 기존 회귀 및 새 소식 검사가 성공했다. 실제 운영7자산 해시, 양 화면·보안 헤더·Instagram503, 모바일 BTS 기사6건·320px 넘침 없음·PC 두 열을 확인했다. 상세 증거와 남은 요건은 RELEASE_REVIEW.md에 기록했다.

Preview는 `npx --offline wrangler@4.148.0`으로 실행했다. Production은 같은 버전을 확인한 npm-cache의 공식 `wrangler/bin/wrangler.js`를 Node로 직접 실행했다. CLI 인자·검증 stage·Functions bundle은 바꾸지 않았다. stage 작성 시 앱 checkout은 clean이었고 이후 수정은 PROJECT_PLAN.md뿐임을 배포 직전에 대조했다. 문서 변경을 새 운영 앱 SHA로 표시하지 않는다.

CLI 완료 URL과 실제 운영 응답을 함께 확인한다. HTML은 Cloudflare 이메일 보호가 변환하므로 원시 HTML 전체 해시 일치를 요구하지 않는다. 새 코드 표식·라우팅·UI를 확인하고 JS/CSS는 정확한 해시로 대조한다. 모바일·PC 확인 후 임시 화면 크기와 시험 언어 선택을 복원한다.

2026-10-09 최신 앱 배포7ce13cb는 CI37820186624, Preview81c93871, Production1cf7b167이다. 앞선85350cb는 CI37815602159, Preview327a64b5, Production48316775다. Pages 자산은no-cache지만 사용자 도메인에서는4시간 캐시를 확인했으므로 앱 변경 시 버전 URL을 갱신한다. 도메인 캐시 규칙 자체가 해결됐다고 기록하지 않는다. 이전 성공한 run의 artifact는 보존 기간 안에서만 복구용으로 사용할 수 있다.

[Cloudflare advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)의 module worker와 ASSETS fallback을 사용한다. 원본 Functions의 라우팅·middleware를 새로 작성하지 않고 공식 build의 출력을 그대로 배포한다.
