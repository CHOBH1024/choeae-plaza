# 아이돌 카탈로그 차트 대조 — 2026-10-11

## 기준

- Melon TOP100과 Melon 아티스트 랭킹(남자 그룹·여자 그룹)을 2026-10-11에 확인했다. 멜론 아티스트 랭킹은 전일의 음원 이용·팬 증가·좋아요·사진·영상 이용을 합산하며, 음원 점수와 팬 증가 점수에 가중치를 둔다.
- YouTube Music 공식 도움말은 Weekly Top Artists를 아티스트 디스코그래피의 공식 MV, 공식 라이브, 공식 곡을 쓴 이용자 영상, 리믹스, 가사 영상 등의 조회수 합으로 설명한다. 이것은 오디오 스트리밍 전용 순위가 아니다.
- 검색으로 확인한 Soundcharts 국내 YouTube 차트는 별도 영상 조회 참고 자료로만 사용했다. YouTube Music 공식 주간 아티스트 순위로 간주하지 않는다.
- “유명 아이돌 전체”는 고정된 완결 목록이 아니므로, 이 기록은 차트 표본에서 기존 카탈로그에 없던 우선 추가 대상을 정한 스냅샷이다.

## 확인된 차트 신호

- **Melon TOP100, 2026-10-11 22:00 표기**: 상위권에 RESCENE 곡 3개(2~4위), I.O.I의 “갑자기”(6위), CORTIS의 “REDRED”(7위), ILLIT의 “It's Me”(10위)가 있었다. ATEEZ도 8위였다.
- **Melon 여자 그룹 아티스트 랭킹, 2026-10-10**: RESCENE 1위, Hearts2Hearts 2위, aespa 3위, IVE 4위, ILLIT 5위, fromis_9 6위, NMIXX 8위, KiiiKiii 9위.
- **Melon 남자 그룹 아티스트 랭킹, 2026-10-10**: BIGBANG 1위, BOYNEXTDOOR 2위, BTS 3위, ATEEZ 4위, N.Flying 5위, NCT WISH 6위, NCT DREAM 7위, DAY6 8위, RIIZE 9위, PLAVE 10위.
- **YouTube 국내 영상 차트 교차 참고**: RESCENE, ATEEZ, ALLDAY PROJECT, CORTIS, aespa, Hearts2Hearts, ILLIT, I.O.I, QWER, KiiiKiii, NMIXX, UNIS 등의 곡이 표시됐다. YouTube Music의 공식 스트리밍 순위라고 표시하지 않는다.

## 이번 코드 변경

기존 아이돌 목록에 없던 다음 14개 이름을 브라우즈/검색 목록과 Pages Functions 허용 목록에 추가했다.

`RESCENE`, `CORTIS`, `I.O.I`, `Hearts2Hearts`, `ILLIT`, `BOYNEXTDOOR`, `N.Flying`, `NCT WISH`, `DAY6`, `PLAVE`, `KiiiKiii`, `ALLDAY PROJECT`, `UNIS`, `NMIXX`.

이름 별칭을 추가하고, 현재 Melon TOP100에서 확인된 대표곡 일부를 빠른 선곡에 넣었다. 공식 YouTube 채널을 확인하지 않은 그룹은 채널이라고 가장하지 않도록 YouTube 검색 링크로 표시한다. 기존 `api.pomyjo.com` 피드 백엔드의 허용 목록·채널 수집 설정은 저장소에 없으므로 이 변경만으로 이 그룹의 최신 영상 피드가 연결됐다고 주장하지 않는다. 서버 목록 동기화는 API 서버 코드 위치·배포를 확인한 뒤 별도로 마쳐야 한다.

## 1차 출처

- [Melon TOP100](https://www.melon.com/chart/)
- [Melon 아티스트 랭킹 — 전체](https://www.melon.com/artistplus/artistchart/index.htm)
- [Melon 아티스트 랭킹 — 남자 그룹](https://www.melon.com/artistplus/artistchart/index.htm?chartGubunCode=MG0000)
- [Melon 아티스트 랭킹 — 여자 그룹](https://www.melon.com/artistplus/artistchart/index.htm?chartGubunCode=FG0000)
- [YouTube Music Charts & Insights — 차트 산정 기준](https://support.google.com/youtubemusic/answer/9014376?hl=en-SGB)
- [국내 YouTube 영상 차트 참고(Soundcharts, 공식 YouTube Music 순위 아님)](https://soundcharts.com/en/charts/youtube/south-korea)
