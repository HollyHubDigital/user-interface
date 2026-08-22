const TRANSLATE_LANGUAGES = [["af", "Afrikaans"], ["sq", "Albanian"], ["am", "Amharic"], ["ar", "Arabic"], ["hy", "Armenian"], ["as", "Assamese"], ["ay", "Aymara"], ["az", "Azerbaijani"], ["bm", "Bambara"], ["eu", "Basque"], ["be", "Belarusian"], ["bn", "Bengali"], ["bho", "Bhojpuri"], ["bs", "Bosnian"], ["bg", "Bulgarian"], ["ca", "Catalan"], ["ceb", "Cebuano"], ["ny", "Chichewa"], ["zh-CN", "Chinese Simplified"], ["zh-TW", "Chinese Traditional"], ["co", "Corsican"], ["hr", "Croatian"], ["cs", "Czech"], ["da", "Danish"], ["dv", "Dhivehi"], ["doi", "Dogri"], ["nl", "Dutch"], ["en", "English"], ["eo", "Esperanto"], ["et", "Estonian"], ["ee", "Ewe"], ["tl", "Filipino"], ["fi", "Finnish"], ["fr", "French"], ["fy", "Frisian"], ["gl", "Galician"], ["ka", "Georgian"], ["de", "German"], ["el", "Greek"], ["gn", "Guarani"], ["gu", "Gujarati"], ["ht", "Haitian Creole"], ["ha", "Hausa"], ["haw", "Hawaiian"], ["iw", "Hebrew"], ["hi", "Hindi"], ["hmn", "Hmong"], ["hu", "Hungarian"], ["is", "Icelandic"], ["ig", "Igbo"], ["ilo", "Ilocano"], ["id", "Indonesian"], ["ga", "Irish"], ["it", "Italian"], ["ja", "Japanese"], ["jw", "Javanese"], ["kn", "Kannada"], ["kk", "Kazakh"], ["km", "Khmer"], ["rw", "Kinyarwanda"], ["gom", "Konkani"], ["ko", "Korean"], ["kri", "Krio"], ["ku", "Kurdish Kurmanji"], ["ckb", "Kurdish Sorani"], ["ky", "Kyrgyz"], ["lo", "Lao"], ["la", "Latin"], ["lv", "Latvian"], ["ln", "Lingala"], ["lt", "Lithuanian"], ["lg", "Luganda"], ["lb", "Luxembourgish"], ["mk", "Macedonian"], ["mai", "Maithili"], ["mg", "Malagasy"], ["ms", "Malay"], ["ml", "Malayalam"], ["mt", "Maltese"], ["mi", "Maori"], ["mr", "Marathi"], ["mni-Mtei", "Meiteilon"], ["lus", "Mizo"], ["mn", "Mongolian"], ["my", "Myanmar Burmese"], ["ne", "Nepali"], ["no", "Norwegian"], ["or", "Odia"], ["om", "Oromo"], ["ps", "Pashto"], ["fa", "Persian"], ["pl", "Polish"], ["pt", "Portuguese"], ["pa", "Punjabi"], ["qu", "Quechua"], ["ro", "Romanian"], ["ru", "Russian"], ["sm", "Samoan"], ["sa", "Sanskrit"], ["gd", "Scots Gaelic"], ["nso", "Sepedi"], ["sr", "Serbian"], ["st", "Sesotho"], ["sn", "Shona"], ["sd", "Sindhi"], ["si", "Sinhala"], ["sk", "Slovak"], ["sl", "Slovenian"], ["so", "Somali"], ["es", "Spanish"], ["su", "Sundanese"], ["sw", "Swahili"], ["sv", "Swedish"], ["tg", "Tajik"], ["ta", "Tamil"], ["tt", "Tatar"], ["te", "Telugu"], ["th", "Thai"], ["ti", "Tigrinya"], ["ts", "Tsonga"], ["tr", "Turkish"], ["tk", "Turkmen"], ["ak", "Twi"], ["uk", "Ukrainian"], ["ur", "Urdu"], ["ug", "Uyghur"], ["uz", "Uzbek"], ["vi", "Vietnamese"], ["cy", "Welsh"], ["xh", "Xhosa"], ["yi", "Yiddish"], ["yo", "Yoruba"], ["zu", "Zulu"]];

function populateTranslateLanguages() {
  const select = document.getElementById("translateLanguage");
  if (!select || select.dataset.ready === "true") return;
  TRANSLATE_LANGUAGES.forEach(([code, name]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    select.appendChild(option);
  });
  select.dataset.ready = "true";
  select.value = localStorage.getItem("aegisTranslateLanguage") || "";
}

function setTranslateCookie(language) {
  const value = language ? `/auto/${language}` : "";
  const expires = language ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = `googtrans=${value}${expires}; path=/`;
  document.cookie = `googtrans=${value}${expires}; path=/; domain=${location.hostname}`;
}

function applySelectedTranslation(language) {
  setTranslateCookie(language);
  if (language) localStorage.setItem("aegisTranslateLanguage", language);
  else localStorage.removeItem("aegisTranslateLanguage");
  const combo = document.querySelector(".goog-te-combo");
  if (combo) {
    combo.value = language;
    combo.dispatchEvent(new Event("change"));
  } else {
    setTimeout(() => location.reload(), 120);
  }
}

function initTranslateWidget() {
  populateTranslateLanguages();
  const toggle = document.getElementById("translateToggle");
  const tray = document.getElementById("translateTray");
  const select = document.getElementById("translateLanguage");
  if (toggle && tray) toggle.onclick = () => tray.classList.toggle("hidden");
  if (select) select.onchange = () => applySelectedTranslation(select.value);
}

window.initGoogleTranslate = function initGoogleTranslate() {
  if (!window.google || !window.google.translate || !document.getElementById("googleTranslateElement")) return;
  new window.google.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "googleTranslateElement");
  const saved = localStorage.getItem("aegisTranslateLanguage") || "";
  if (saved) setTimeout(() => applySelectedTranslation(saved), 500);
};

initTranslateWidget();
