/* Pinned Cities: English and Korean text for the site's buttons and labels. Place names stay as saved. */
(function (root) {
  "use strict";
  var T = {
    en: {
      eyebrow: "{p} saved places · {c} cities",
      basket: "Basket",
      allCities: "All cities",
      worldMeta: "{p} places in {c} cities · updated {d}",
      cityMeta: "{n} saved here · updated {d}",
      city: "City", category: "Category", all: "All", allNCities: "All {n} cities…",
      search: "Search {city}", searchWorld: "Search every city",
      topPicks: "Top picks", topPick: "Top pick",
      sort: "Sort", sortList: "By list", sortAZ: "A–Z", sortCenter: "Closest to map center", sortPicks: "Top picks first",
      inView: "Only places on the map",
      showing: "{n} places", showingOne: "1 place",
      openGM: "Open in Google Maps ↗", add: "+ Basket", added: "✓ In basket", share: "Share", linkCopied: "Link copied",
      linkReady: "Copy this link:", noPin: "No pin on the map",
      nothing: "Nothing matches “{q}” here.", nothingFilter: "Nothing matches these filters here.",
      nothingView: "No places in this part of the map. Zoom out, or turn off “Only places on the map”.",
      tip: "Tap a name to find it on the map. In Google Maps, tap <strong>Save</strong> to add a place to your own lists.",
      mapNote: "Pins are close to the real spot. Open a place in Google Maps for the exact door.",
      worldNote: "Tap a city bubble or card to open it.",
      pickCity: "Pick a city", placesN: "{n} places",
      bagBar: "<strong>{n}</strong> in your basket", viewBasket: "View basket",
      yourBasket: "Your basket", back: "Back to guide",
      bagEmpty: "Your basket is empty. Tap <strong>+ Basket</strong> on any place to add it.",
      saveLink: "Save ↗", remove: "Remove",
      walkTotal: "In walking order · about {d} on foot", walkLeg: "{d} · {m} min walk", walkNote: "Walking times are rough estimates from straight-line distance.",
      putTitle: "Put them in your Google Maps",
      oneTitle: "One by one", oneBody: "Tap <strong>Save ↗</strong> next to a place. In Google Maps, tap Save and pick a list. Best for a handful of places.",
      routeTitle: "As a route", routeBody: "Opens the places as stops on one Google Maps route in walking order, up to 10 per link. Stops are found by name, so check them.",
      routeLink: "{city} route ↗", stops: " · stops {a}–{b}",
      mmTitle: "All at once with Google My Maps",
      mmBody: "Download the basket as a file, then go to {link}, create a new map, choose <strong>Import</strong> and pick the file. Use Latitude and Longitude for the position and Name for the title. The map then shows in the Google Maps app under <strong>Saved › Maps</strong>.",
      dl: "Download for My Maps (.csv)", copy: "Copy list", clear: "Clear basket", clearConfirm: "Clear all {n}?",
      copied: "Copied {n} places with their Google Maps links.", copyFail: "Couldn't copy automatically. The list is selected below, so copy it yourself.",
      downloaded: "Downloaded. Import it in Google My Maps.", downloadedSkip: " {n} without a pin was left out.",
      themeAuto: "Auto", themeLight: "Light", themeDark: "Dark", themeLabel: "Theme: {m}. Tap to change.",
      langBtn: "한국어", langLabel: "Switch to Korean",
      loading: "Loading places…", loadFail: "The places couldn't load. Refresh the page to try again.",
      mapOff: "The map couldn't load right now. Every place still has its Google Maps link.",
      noWebGL: "This browser can't draw the map. Every place still has its Google Maps link.",
      other: "Other places", updatedFmt: "en-US",
      about: "About this place", where: "Where", kind: "Type", hours: "Hours", website: "Website", sources: "Sources:",
      hoursNote: "From OpenStreetMap. Check before you go.",
      followTitle: "Save whole lists to your Google Maps", followHelp: "Opens the list in Google Maps. Tap Follow to add it to your Saved places."
    },
    ko: {
      eyebrow: "저장한 장소 {p}곳 · 도시 {c}곳",
      basket: "장바구니",
      allCities: "모든 도시",
      worldMeta: "도시 {c}곳, 장소 {p}곳 · {d} 업데이트",
      cityMeta: "{n}곳 저장 · {d} 업데이트",
      city: "도시", category: "카테고리", all: "전체", allNCities: "전체 도시 {n}곳…",
      search: "{city}에서 검색", searchWorld: "모든 도시에서 검색",
      topPicks: "추천", topPick: "추천",
      sort: "정렬", sortList: "목록순", sortAZ: "이름순", sortCenter: "지도 중심에서 가까운 순", sortPicks: "추천 먼저",
      inView: "지도에 보이는 곳만",
      showing: "{n}곳", showingOne: "1곳",
      openGM: "구글 지도에서 열기 ↗", add: "+ 담기", added: "✓ 담음", share: "공유", linkCopied: "링크를 복사했어요",
      linkReady: "이 링크를 복사하세요:", noPin: "지도에 핀 없음",
      nothing: "“{q}”에 맞는 곳이 없어요.", nothingFilter: "이 조건에 맞는 곳이 없어요.",
      nothingView: "지도의 이 부분에는 장소가 없어요. 지도를 축소하거나 ‘지도에 보이는 곳만’을 끄세요.",
      tip: "이름을 누르면 지도에서 찾아줘요. 구글 지도에서 <strong>저장</strong>을 누르면 내 목록에 추가돼요.",
      mapNote: "핀은 실제 위치와 가까워요. 정확한 입구는 구글 지도에서 확인하세요.",
      worldNote: "도시 원이나 카드를 누르면 열려요.",
      pickCity: "도시를 고르세요", placesN: "{n}곳",
      bagBar: "장바구니에 <strong>{n}곳</strong>", viewBasket: "장바구니 보기",
      yourBasket: "장바구니", back: "가이드로 돌아가기",
      bagEmpty: "장바구니가 비어 있어요. 장소의 <strong>+ 담기</strong>를 눌러 추가하세요.",
      saveLink: "저장 ↗", remove: "빼기",
      walkTotal: "걷는 순서 · 도보 총 약 {d}", walkLeg: "{d} · 도보 약 {m}분", walkNote: "도보 시간은 직선거리로 계산한 대략적인 값이에요.",
      putTitle: "내 구글 지도에 넣기",
      oneTitle: "하나씩", oneBody: "장소 옆 <strong>저장 ↗</strong>을 누르고 구글 지도에서 ‘저장’을 눌러 목록을 고르세요. 몇 곳만 담을 때 좋아요.",
      routeTitle: "경로로", routeBody: "장소를 걷는 순서대로 구글 지도 경로의 경유지로 열어요. 링크당 최대 10곳이고, 이름으로 찾기 때문에 경유지를 한 번 확인하세요.",
      routeLink: "{city} 경로 ↗", stops: " · {a}–{b}번",
      mmTitle: "구글 My Maps로 한 번에",
      mmBody: "장바구니를 파일로 받은 뒤 {link}에서 새 지도를 만들고 <strong>가져오기</strong>로 파일을 고르세요. 위치는 Latitude와 Longitude, 제목은 Name을 고르면 돼요. 그러면 구글 지도 앱의 <strong>저장됨 › 지도</strong>에 나타나요.",
      dl: "My Maps용 다운로드 (.csv)", copy: "목록 복사", clear: "비우기", clearConfirm: "{n}곳 모두 비울까요?",
      copied: "{n}곳을 구글 지도 링크와 함께 복사했어요.", copyFail: "자동으로 복사하지 못했어요. 아래에 선택된 목록을 직접 복사하세요.",
      downloaded: "다운로드했어요. 구글 My Maps에서 가져오세요.", downloadedSkip: " 핀이 없는 {n}곳은 빠졌어요.",
      themeAuto: "자동", themeLight: "라이트", themeDark: "다크", themeLabel: "테마: {m}. 눌러서 바꾸기.",
      langBtn: "English", langLabel: "Switch to English",
      loading: "장소를 불러오는 중…", loadFail: "장소를 불러오지 못했어요. 새로고침해 주세요.",
      mapOff: "지금은 지도를 불러올 수 없어요. 모든 장소에 구글 지도 링크가 있어요.",
      noWebGL: "이 브라우저에서는 지도를 그릴 수 없어요. 모든 장소에 구글 지도 링크가 있어요.",
      other: "기타 장소", updatedFmt: "ko-KR",
      about: "장소 정보", where: "위치", kind: "종류", hours: "영업시간", website: "웹사이트", sources: "출처:",
      hoursNote: "OpenStreetMap 정보예요. 방문 전에 확인하세요.",
      followTitle: "목록 전체를 내 구글 지도에 저장", followHelp: "구글 지도에서 목록이 열려요. ‘팔로우’를 누르면 저장됨에 추가돼요."
    }
  };
  var CAT_KO = {
    "Activities": "액티비티", "Art": "아트", "Books": "서점", "Cafes": "카페", "Clothes": "옷", "Clubs": "클럽", "Designs": "디자인",
    "Drinks": "술", "Exhibitions": "전시", "Food": "음식", "Hotels": "호텔", "Images": "이미지", "Markets": "마켓", "Nature": "자연",
    "Pubs": "펍", "Records": "레코드", "Sights": "명소", "Sound": "사운드", "Stay": "숙소", "Tapas": "타파스", "Tech": "테크",
    "Utility": "생활", "Default list": "기본 목록"
  };
  var CITY_KO = {
    "Tokyo": "도쿄", "New York": "뉴욕", "Seoul": "서울", "London": "런던", "Berlin": "베를린", "Pittsburgh": "피츠버그", "Paris": "파리",
    "Prague": "프라하", "Los Angeles": "로스앤젤레스", "Honolulu": "호놀룰루", "Madrid": "마드리드", "Chicago": "시카고", "Manchester": "맨체스터",
    "Amsterdam": "암스테르담", "Osaka": "오사카", "Edinburgh": "에든버러", "San Francisco": "샌프란시스코", "Copenhagen": "코펜하겐",
    "Yokohama": "요코하마", "Athens": "아테네", "Dublin": "더블린", "Barcelona": "바르셀로나", "Cologne": "쾰른", "Washington DC": "워싱턴 DC",
    "Sapporo": "삿포로", "Oakland": "오클랜드", "Fukuoka": "후쿠오카", "Gruyères": "그뤼에르", "Hoi An": "호이안", "Brussels": "브뤼셀",
    "Medford": "메드퍼드", "Taipei": "타이베이", "Kyoto": "교토", "Lisbon": "리스본", "Glasgow": "글래스고", "Essaouira": "에사우이라",
    "Cheonan": "천안", "Saint-Tropez": "생트로페", "Menorca": "메노르카", "Dubrovnik": "두브로브니크", "Bucharest": "부쿠레슈티", "Bali": "발리",
    "Valencia": "발렌시아", "Stockholm": "스톡홀름", "Milan": "밀라노", "Mexico City": "멕시코시티", "Budapest": "부다페스트", "Miami": "마이애미",
    "Rome": "로마", "Nice": "니스", "Napa Valley": "나파 밸리", "Tel Aviv": "텔아비브", "Manila": "마닐라", "Gotemba": "고텐바", "Munich": "뮌헨",
    "Hakodate": "하코다테", "Tbilisi": "트빌리시", "Melbourne": "멜버른", "Kingston": "킹스턴", "Rotterdam": "로테르담", "Montreal": "몬트리올",
    "Busan": "부산", "Jeju": "제주", "Incheon": "인천", "Daejeon": "대전", "Da Nang": "다낭", "Bangkok": "방콕", "Singapore": "싱가포르",
    "Hong Kong": "홍콩", "Shanghai": "상하이", "Beijing": "베이징", "Ibiza": "이비사", "Vienna": "빈", "Zurich": "취리히", "Hamburg": "함부르크"
  };
  var lang = "en";
  function t(key, vars) {
    var s = (T[lang] && T[lang][key]) || T.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  root.I18N = {
    t: t,
    get lang() { return lang; },
    set: function (l) { lang = T[l] ? l : "en"; },
    cat: function (c) { return lang === "ko" && CAT_KO[c] ? CAT_KO[c] : c; },
    city: function (c) { return lang === "ko" && CITY_KO[c] ? CITY_KO[c] : c; }
  };
})(this);
