/**
 * SoufAI Time & Timezone Engine
 * Full IANA Time Zone Database support with DST, country/city resolution, flags, and time conversions.
 */

export interface TimeZoneResult {
  success: boolean;
  isAmbiguous?: boolean;
  countryName?: string;
  cityName?: string;
  cityEn?: string;
  countryEn?: string;
  flagEmoji?: string;
  suggestedCities?: { nameAr: string; nameEn: string; query: string }[];
  questionPrompt?: string;
  timezone: string;
  localTime: string;        // e.g. "01:32:45"
  localTimeShort: string;   // e.g. "01:32"
  localDate: string;        // e.g. "2026-08-10"
  year: number;
  monthShortAr: string;     // e.g. "أوت" / "أغسطس"
  monthShortEn: string;     // e.g. "AUG"
  dayOfMonth: number;
  dayOfWeekAr: string;      // e.g. "الإثنين"
  dayOfWeekEn: string;      // e.g. "MON"
  formattedDateAr: string;  // e.g. "الإثنين 10 أغسطس 2026"
  formattedDateEn: string;  // e.g. "Monday, August 10, 2026"
  utcOffset: string;        // e.g. "+09:00"
  isDST: boolean;
  rawTimestamp: number;
}

export interface ConvertTimeResult {
  success: boolean;
  error?: string;
  fromTimezone: string;
  toTimezone: string;
  fromLocationLabel: string;
  toLocationLabel: string;
  fromFlag?: string;
  toFlag?: string;
  originalTime: string;
  convertedTime: string;
  convertedTimeShort: string;
  convertedDate: string;
  convertedFormattedAr: string;
  convertedFormattedEn: string;
  convertedDayOfWeekAr: string;
  fromUtcOffset: string;
  toUtcOffset: string;
  fromIsDST: boolean;
  toIsDST: boolean;
}

// Multi-timezone countries that MUST NOT be guessed when no city/state is specified
const AMBIGUOUS_COUNTRIES: Record<
  string,
  {
    ar: string;
    en: string;
    citiesPromptAr: string;
    citiesPromptEn: string;
    suggestedCities: { nameAr: string; nameEn: string; query: string }[];
  }
> = {
  usa: {
    ar: "أمريكا (الولايات المتحدة)",
    en: "United States",
    citiesPromptAr: "أي مدينة أو ولاية في أمريكا تريد معرفة توقيتها؟",
    citiesPromptEn: "Which city or state in the US would you like to check?",
    suggestedCities: [
      { nameAr: "نيويورك", nameEn: "New York", query: "كم الساعة في نيويورك؟" },
      { nameAr: "لوس أنجلوس", nameEn: "Los Angeles", query: "كم الساعة في لوس أنجلوس؟" },
      { nameAr: "شيكاغو", nameEn: "Chicago", query: "كم الساعة في شيكاغو؟" },
      { nameAr: "دنفر", nameEn: "Denver", query: "كم الساعة في دنفر؟" },
    ],
  },
  "الولايات المتحدة": {
    ar: "الولايات المتحدة الأمريكية",
    en: "United States",
    citiesPromptAr: "أي مدينة أو ولاية في أمريكا تريد معرفة توقيتها؟",
    citiesPromptEn: "Which city or state in the US would you like to check?",
    suggestedCities: [
      { nameAr: "نيويورك", nameEn: "New York", query: "كم الساعة في نيويورك؟" },
      { nameAr: "لوس أنجلوس", nameEn: "Los Angeles", query: "كم الساعة في لوس أنجلوس؟" },
      { nameAr: "شيكاغو", nameEn: "Chicago", query: "كم الساعة في شيكاغو؟" },
      { nameAr: "دنفر", nameEn: "Denver", query: "كم الساعة في دنفر؟" },
    ],
  },
  أمريكا: {
    ar: "أمريكا",
    en: "United States",
    citiesPromptAr: "أي مدينة أو ولاية في أمريكا تريد معرفة توقيتها؟",
    citiesPromptEn: "Which city or state in the US?",
    suggestedCities: [
      { nameAr: "نيويورك", nameEn: "New York", query: "كم الساعة في نيويورك؟" },
      { nameAr: "لوس أنجلوس", nameEn: "Los Angeles", query: "كم الساعة في لوس أنجلوس؟" },
      { nameAr: "شيكاغو", nameEn: "Chicago", query: "كم الساعة في شيكاغو؟" },
      { nameAr: "دنفر", nameEn: "Denver", query: "كم الساعة في دنفر؟" },
    ],
  },
  امريكا: {
    ar: "أمريكا",
    en: "United States",
    citiesPromptAr: "أي مدينة أو ولاية في أمريكا تريد معرفة توقيتها؟",
    citiesPromptEn: "Which city or state in the US?",
    suggestedCities: [
      { nameAr: "نيويورك", nameEn: "New York", query: "كم الساعة في نيويورك؟" },
      { nameAr: "لوس أنجلوس", nameEn: "Los Angeles", query: "كم الساعة في لوس أنجلوس؟" },
      { nameAr: "شيكاغو", nameEn: "Chicago", query: "كم الساعة في شيكاغو؟" },
      { nameAr: "دنفر", nameEn: "Denver", query: "كم الساعة في دنفر؟" },
    ],
  },
  كندا: {
    ar: "كندا",
    en: "Canada",
    citiesPromptAr: "أي مدينة في كندا؟",
    citiesPromptEn: "Which city in Canada?",
    suggestedCities: [
      { nameAr: "تورونتو", nameEn: "Toronto", query: "كم الساعة في تورونتو؟" },
      { nameAr: "فانكوفر", nameEn: "Vancouver", query: "كم الساعة في فانكوفر؟" },
      { nameAr: "مونتريال", nameEn: "Montreal", query: "كم الساعة في مونتريال؟" },
    ],
  },
  canada: {
    ar: "كندا",
    en: "Canada",
    citiesPromptAr: "أي مدينة في كندا؟",
    citiesPromptEn: "Which city in Canada?",
    suggestedCities: [
      { nameAr: "تورونتو", nameEn: "Toronto", query: "كم الساعة في تورونتو؟" },
      { nameAr: "فانكوفر", nameEn: "Vancouver", query: "كم الساعة في فانكوفر؟" },
      { nameAr: "مونتريال", nameEn: "Montreal", query: "كم الساعة في مونتريال؟" },
    ],
  },
  أستراليا: {
    ar: "أستراليا",
    en: "Australia",
    citiesPromptAr: "أي مدينة في أستراليا؟",
    citiesPromptEn: "Which city in Australia?",
    suggestedCities: [
      { nameAr: "سيدني", nameEn: "Sydney", query: "كم الساعة في سيدني؟" },
      { nameAr: "ملبورن", nameEn: "Melbourne", query: "كم الساعة في ملبورن؟" },
      { nameAr: "بيرث", nameEn: "Perth", query: "كم الساعة في بيرث؟" },
    ],
  },
  استراليا: {
    ar: "أستراليا",
    en: "Australia",
    citiesPromptAr: "أي مدينة في أستراليا؟",
    citiesPromptEn: "Which city in Australia?",
    suggestedCities: [
      { nameAr: "سيدني", nameEn: "Sydney", query: "كم الساعة في سيدني؟" },
      { nameAr: "ملبورن", nameEn: "Melbourne", query: "كم الساعة في ملبورن؟" },
      { nameAr: "بيرث", nameEn: "Perth", query: "كم الساعة في بيرث؟" },
    ],
  },
  australia: {
    ar: "أستراليا",
    en: "Australia",
    citiesPromptAr: "أي مدينة في أستراليا؟",
    citiesPromptEn: "Which city in Australia?",
    suggestedCities: [
      { nameAr: "سيدني", nameEn: "Sydney", query: "كم الساعة في سيدني؟" },
      { nameAr: "ملبورن", nameEn: "Melbourne", query: "كم الساعة في ملبورن؟" },
      { nameAr: "بيرث", nameEn: "Perth", query: "كم الساعة في بيرث؟" },
    ],
  },
  البرازيل: {
    ar: "البرازيل",
    en: "Brazil",
    citiesPromptAr: "أي مدينة في البرازيل؟",
    citiesPromptEn: "Which city in Brazil?",
    suggestedCities: [
      { nameAr: "ساو باولو", nameEn: "Sao Paulo", query: "كم الساعة في ساو باولو؟" },
      { nameAr: "ريو دي جانيرو", nameEn: "Rio de Janeiro", query: "كم الساعة في ريو دي جانيرو؟" },
      { nameAr: "برازيليا", nameEn: "Brasilia", query: "كم الساعة في برازيليا؟" },
    ],
  },
  روسيا: {
    ar: "روسيا",
    en: "Russia",
    citiesPromptAr: "أي مدينة في روسيا؟",
    citiesPromptEn: "Which city in Russia?",
    suggestedCities: [
      { nameAr: "موسكو", nameEn: "Moscow", query: "كم الساعة في موسكو؟" },
      { nameAr: "سانت بطرسبرغ", nameEn: "Saint Petersburg", query: "كم الساعة في سانت بطرسبرغ؟" },
      { nameAr: "نوفوسيبيرسك", nameEn: "Novosibirsk", query: "كم الساعة في نوفوسيبيرسك؟" },
    ],
  },
};

// Location / City / Country mapping to IANA Time Zones & Flags
const LOCATION_TIMEZONE_MAP: Record<
  string,
  { timezone: string; labelAr: string; labelEn: string; countryEn: string; flag: string }
> = {
  // Arab Countries & Cities
  المغرب: { timezone: "Africa/Casablanca", labelAr: "الرباط، المغرب", labelEn: "Rabat, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  مغرب: { timezone: "Africa/Casablanca", labelAr: "الرباط، المغرب", labelEn: "Rabat, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  morocco: { timezone: "Africa/Casablanca", labelAr: "Rabat, Morocco", labelEn: "Rabat, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  maroc: { timezone: "Africa/Casablanca", labelAr: "Rabat, Maroc", labelEn: "Rabat, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  "الدار البيضاء": { timezone: "Africa/Casablanca", labelAr: "الدار البيضاء، المغرب", labelEn: "Casablanca, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  كازابلانكا: { timezone: "Africa/Casablanca", labelAr: "الدار البيضاء، المغرب", labelEn: "Casablanca, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  casablanca: { timezone: "Africa/Casablanca", labelAr: "Casablanca, Morocco", labelEn: "Casablanca, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  الرباط: { timezone: "Africa/Casablanca", labelAr: "الرباط، المغرب", labelEn: "Rabat, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  rabat: { timezone: "Africa/Casablanca", labelAr: "Rabat, Morocco", labelEn: "Rabat, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  طنجة: { timezone: "Africa/Casablanca", labelAr: "طنجة، المغرب", labelEn: "Tangier, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  مراكش: { timezone: "Africa/Casablanca", labelAr: "مراكش، المغرب", labelEn: "Marrakech, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  فاس: { timezone: "Africa/Casablanca", labelAr: "فاس، المغرب", labelEn: "Fes, Morocco", countryEn: "Morocco", flag: "🇲🇦" },

  السعودية: { timezone: "Asia/Riyadh", labelAr: "الرياض، السعودية", labelEn: "Riyadh, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  "المملكة العربية السعودية": { timezone: "Asia/Riyadh", labelAr: "الرياض، السعودية", labelEn: "Riyadh, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  saudi: { timezone: "Asia/Riyadh", labelAr: "Riyadh, Saudi Arabia", labelEn: "Riyadh, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  الرياض: { timezone: "Asia/Riyadh", labelAr: "الرياض، السعودية", labelEn: "Riyadh, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  riyadh: { timezone: "Asia/Riyadh", labelAr: "Riyadh, Saudi Arabia", labelEn: "Riyadh, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  جدة: { timezone: "Asia/Riyadh", labelAr: "جدة، السعودية", labelEn: "Jeddah, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  jeddah: { timezone: "Asia/Riyadh", labelAr: "Jeddah, Saudi Arabia", labelEn: "Jeddah, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  مكة: { timezone: "Asia/Riyadh", labelAr: "مكة المكرمة، السعودية", labelEn: "Mecca, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  mecca: { timezone: "Asia/Riyadh", labelAr: "Mecca, Saudi Arabia", labelEn: "Mecca, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },
  "المدينة المنورة": { timezone: "Asia/Riyadh", labelAr: "المدينة المنورة، السعودية", labelEn: "Medina, Saudi Arabia", countryEn: "Saudi Arabia", flag: "🇸🇦" },

  الإمارات: { timezone: "Asia/Dubai", labelAr: "دبي، الإمارات", labelEn: "Dubai, UAE", countryEn: "United Arab Emirates", flag: "🇦🇪" },
  امارات: { timezone: "Asia/Dubai", labelAr: "دبي، الإمارات", labelEn: "Dubai, UAE", countryEn: "United Arab Emirates", flag: "🇦🇪" },
  "الإمارات العربية المتحدة": { timezone: "Asia/Dubai", labelAr: "دبي، الإمارات", labelEn: "Dubai, UAE", countryEn: "United Arab Emirates", flag: "🇦🇪" },
  uae: { timezone: "Asia/Dubai", labelAr: "Dubai, UAE", labelEn: "Dubai, UAE", countryEn: "United Arab Emirates", flag: "🇦🇪" },
  دبي: { timezone: "Asia/Dubai", labelAr: "دبي، الإمارات", labelEn: "Dubai, UAE", countryEn: "United Arab Emirates", flag: "🇦🇪" },
  dubai: { timezone: "Asia/Dubai", labelAr: "Dubai, UAE", labelEn: "Dubai, UAE", countryEn: "United Arab Emirates", flag: "🇦🇪" },
  أبوظبي: { timezone: "Asia/Dubai", labelAr: "أبوظبي، الإمارات", labelEn: "Abu Dhabi, UAE", countryEn: "United Arab Emirates", flag: "🇦🇪" },

  مصر: { timezone: "Africa/Cairo", labelAr: "القاهرة، مصر", labelEn: "Cairo, Egypt", countryEn: "Egypt", flag: "🇪🇬" },
  egypt: { timezone: "Africa/Cairo", labelAr: "Cairo, Egypt", labelEn: "Cairo, Egypt", countryEn: "Egypt", flag: "🇪🇬" },
  القاهرة: { timezone: "Africa/Cairo", labelAr: "القاهرة، مصر", labelEn: "Cairo, Egypt", countryEn: "Egypt", flag: "🇪🇬" },
  cairo: { timezone: "Africa/Cairo", labelAr: "Cairo, Egypt", labelEn: "Cairo, Egypt", countryEn: "Egypt", flag: "🇪🇬" },

  قطر: { timezone: "Asia/Qatar", labelAr: "الدوحة، قطر", labelEn: "Doha, Qatar", countryEn: "Qatar", flag: "🇶🇦" },
  الدوحة: { timezone: "Asia/Qatar", labelAr: "الدوحة، قطر", labelEn: "Doha, Qatar", countryEn: "Qatar", flag: "🇶🇦" },

  الكويت: { timezone: "Asia/Kuwait", labelAr: "الكويت", labelEn: "Kuwait City, Kuwait", countryEn: "Kuwait", flag: "🇰🇼" },
  kuwait: { timezone: "Asia/Kuwait", labelAr: "الكويت", labelEn: "Kuwait City, Kuwait", countryEn: "Kuwait", flag: "🇰🇼" },
  "سلطنة عمان": { timezone: "Asia/Muscat", labelAr: "مسقط، عُمان", labelEn: "Muscat, Oman", countryEn: "Oman", flag: "🇴🇲" },
  عُمان: { timezone: "Asia/Muscat", labelAr: "مسقط، عُمان", labelEn: "Muscat, Oman", countryEn: "Oman", flag: "🇴🇲" },
  مسقط: { timezone: "Asia/Muscat", labelAr: "مسقط، عُمان", labelEn: "Muscat, Oman", countryEn: "Oman", flag: "🇴🇲" },
  صلالة: { timezone: "Asia/Muscat", labelAr: "صلالة، عُمان", labelEn: "Salalah, Oman", countryEn: "Oman", flag: "🇴🇲" },
  muscat: { timezone: "Asia/Muscat", labelAr: "Muscat, Oman", labelEn: "Muscat, Oman", countryEn: "Oman", flag: "🇴🇲" },
  oman: { timezone: "Asia/Muscat", labelAr: "Muscat, Oman", labelEn: "Muscat, Oman", countryEn: "Oman", flag: "🇴🇲" },
  البحرين: { timezone: "Asia/Bahrain", labelAr: "المنامة، البحرين", labelEn: "Manama, Bahrain", countryEn: "Bahrain", flag: "🇧🇭" },
  المنامة: { timezone: "Asia/Bahrain", labelAr: "المنامة، البحرين", labelEn: "Manama, Bahrain", countryEn: "Bahrain", flag: "🇧🇭" },
  manama: { timezone: "Asia/Bahrain", labelAr: "Manama, Bahrain", labelEn: "Manama, Bahrain", countryEn: "Bahrain", flag: "🇧🇭" },
  bahrain: { timezone: "Asia/Bahrain", labelAr: "Manama, Bahrain", labelEn: "Manama, Bahrain", countryEn: "Bahrain", flag: "🇧🇭" },
  الأردن: { timezone: "Asia/Amman", labelAr: "عمّان، الأردن", labelEn: "Amman, Jordan", countryEn: "Jordan", flag: "🇯🇴" },
  الاردن: { timezone: "Asia/Amman", labelAr: "عمّان، الأردن", labelEn: "Amman, Jordan", countryEn: "Jordan", flag: "🇯🇴" },
  عمّان: { timezone: "Asia/Amman", labelAr: "عمّان، الأردن", labelEn: "Amman, Jordan", countryEn: "Jordan", flag: "🇯🇴" },
  عمان: { timezone: "Asia/Amman", labelAr: "عمّان، الأردن", labelEn: "Amman, Jordan", countryEn: "Jordan", flag: "🇯🇴" },
  amman: { timezone: "Asia/Amman", labelAr: "Amman, Jordan", labelEn: "Amman, Jordan", countryEn: "Jordan", flag: "🇯🇴" },
  jordan: { timezone: "Asia/Amman", labelAr: "Amman, Jordan", labelEn: "Amman, Jordan", countryEn: "Jordan", flag: "🇯🇴" },
  لبنان: { timezone: "Asia/Beirut", labelAr: "بيروت، لبنان", labelEn: "Beirut, Lebanon", countryEn: "Lebanon", flag: "🇱🇧" },
  بيروت: { timezone: "Asia/Beirut", labelAr: "بيروت، لبنان", labelEn: "Beirut, Lebanon", countryEn: "Lebanon", flag: "🇱🇧" },
  beirut: { timezone: "Asia/Beirut", labelAr: "Beirut, Lebanon", labelEn: "Beirut, Lebanon", countryEn: "Lebanon", flag: "🇱🇧" },
  lebanon: { timezone: "Asia/Beirut", labelAr: "Beirut, Lebanon", labelEn: "Beirut, Lebanon", countryEn: "Lebanon", flag: "🇱🇧" },
  سوريا: { timezone: "Asia/Damascus", labelAr: "دمشق، سوريا", labelEn: "Damascus, Syria", countryEn: "Syria", flag: "🇸🇾" },
  دمشق: { timezone: "Asia/Damascus", labelAr: "دمشق، سوريا", labelEn: "Damascus, Syria", countryEn: "Syria", flag: "🇸🇾" },
  حلب: { timezone: "Asia/Damascus", labelAr: "حلب، سوريا", labelEn: "Aleppo, Syria", countryEn: "Syria", flag: "🇸🇾" },
  damascus: { timezone: "Asia/Damascus", labelAr: "Damascus, Syria", labelEn: "Damascus, Syria", countryEn: "Syria", flag: "🇸🇾" },
  syria: { timezone: "Asia/Damascus", labelAr: "Damascus, Syria", labelEn: "Damascus, Syria", countryEn: "Syria", flag: "🇸🇾" },
  فلسطين: { timezone: "Asia/Gaza", labelAr: "القدس، فلسطين", labelEn: "Jerusalem, Palestine", countryEn: "Palestine", flag: "🇵🇸" },
  القدس: { timezone: "Asia/Jerusalem", labelAr: "القدس، فلسطين", labelEn: "Jerusalem, Palestine", countryEn: "Palestine", flag: "🇵🇸" },
  غزة: { timezone: "Asia/Gaza", labelAr: "غزة، فلسطين", labelEn: "Gaza, Palestine", countryEn: "Palestine", flag: "🇵🇸" },
  "رام الله": { timezone: "Asia/Hebron", labelAr: "رام الله، فلسطين", labelEn: "Ramallah, Palestine", countryEn: "Palestine", flag: "🇵🇸" },
  palestine: { timezone: "Asia/Jerusalem", labelAr: "Jerusalem, Palestine", labelEn: "Jerusalem, Palestine", countryEn: "Palestine", flag: "🇵🇸" },
  jerusalem: { timezone: "Asia/Jerusalem", labelAr: "Jerusalem, Palestine", labelEn: "Jerusalem, Palestine", countryEn: "Palestine", flag: "🇵🇸" },
  العراق: { timezone: "Asia/Baghdad", labelAr: "بغداد، العراق", labelEn: "Baghdad, Iraq", countryEn: "Iraq", flag: "🇮🇶" },
  بغداد: { timezone: "Asia/Baghdad", labelAr: "بغداد، العراق", labelEn: "Baghdad, Iraq", countryEn: "Iraq", flag: "🇮🇶" },
  البصرة: { timezone: "Asia/Baghdad", labelAr: "البصرة، العراق", labelEn: "Basra, Iraq", countryEn: "Iraq", flag: "🇮🇶" },
  أربيل: { timezone: "Asia/Baghdad", labelAr: "أربيل، العراق", labelEn: "Erbil, Iraq", countryEn: "Iraq", flag: "🇮🇶" },
  baghdad: { timezone: "Asia/Baghdad", labelAr: "Baghdad, Iraq", labelEn: "Baghdad, Iraq", countryEn: "Iraq", flag: "🇮🇶" },
  iraq: { timezone: "Asia/Baghdad", labelAr: "Baghdad, Iraq", labelEn: "Baghdad, Iraq", countryEn: "Iraq", flag: "🇮🇶" },
  اليمن: { timezone: "Asia/Aden", labelAr: "صنعاء، اليمن", labelEn: "Sanaa, Yemen", countryEn: "Yemen", flag: "🇾🇪" },
  صنعاء: { timezone: "Asia/Aden", labelAr: "صنعاء، اليمن", labelEn: "Sanaa, Yemen", countryEn: "Yemen", flag: "🇾🇪" },
  عدن: { timezone: "Asia/Aden", labelAr: "عدن، اليمن", labelEn: "Aden, Yemen", countryEn: "Yemen", flag: "🇾🇪" },
  yemen: { timezone: "Asia/Aden", labelAr: "Sanaa, Yemen", labelEn: "Sanaa, Yemen", countryEn: "Yemen", flag: "🇾🇪" },
  sanaa: { timezone: "Asia/Aden", labelAr: "Sanaa, Yemen", labelEn: "Sanaa, Yemen", countryEn: "Yemen", flag: "🇾🇪" },
  الجزائر: { timezone: "Africa/Algiers", labelAr: "الجزائر العاصمة", labelEn: "Algiers, Algeria", countryEn: "Algeria", flag: "🇩🇿" },
  algiers: { timezone: "Africa/Algiers", labelAr: "الجزائر العاصمة", labelEn: "Algiers, Algeria", countryEn: "Algeria", flag: "🇩🇿" },
  algeria: { timezone: "Africa/Algiers", labelAr: "الجزائر العاصمة", labelEn: "Algiers, Algeria", countryEn: "Algeria", flag: "🇩🇿" },
  وهران: { timezone: "Africa/Algiers", labelAr: "وهران، الجزائر", labelEn: "Oran, Algeria", countryEn: "Algeria", flag: "🇩🇿" },
  قسنطينة: { timezone: "Africa/Algiers", labelAr: "قسنطينة، الجزائر", labelEn: "Constantine, Algeria", countryEn: "Algeria", flag: "🇩🇿" },
  عنابة: { timezone: "Africa/Algiers", labelAr: "عنابة، الجزائر", labelEn: "Annaba, Algeria", countryEn: "Algeria", flag: "🇩🇿" },
  تونس: { timezone: "Africa/Tunis", labelAr: "تونس العاصمة", labelEn: "Tunis, Tunisia", countryEn: "Tunisia", flag: "🇹🇳" },
  tunis: { timezone: "Africa/Tunis", labelAr: "تونس العاصمة", labelEn: "Tunis, Tunisia", countryEn: "Tunisia", flag: "🇹🇳" },
  tunisia: { timezone: "Africa/Tunis", labelAr: "تونس العاصمة", labelEn: "Tunis, Tunisia", countryEn: "Tunisia", flag: "🇹🇳" },
  صفاقس: { timezone: "Africa/Tunis", labelAr: "صفاقس، تونس", labelEn: "Sfax, Tunisia", countryEn: "Tunisia", flag: "🇹🇳" },
  سوسة: { timezone: "Africa/Tunis", labelAr: "سوسة، تونس", labelEn: "Sousse, Tunisia", countryEn: "Tunisia", flag: "🇹🇳" },
  ليبيا: { timezone: "Africa/Tripoli", labelAr: "طرابلس، ليبيا", labelEn: "Tripoli, Libya", countryEn: "Libya", flag: "🇱🇾" },
  طرابلس: { timezone: "Africa/Tripoli", labelAr: "طرابلس، ليبيا", labelEn: "Tripoli, Libya", countryEn: "Libya", flag: "🇱🇾" },
  بنغازي: { timezone: "Africa/Tripoli", labelAr: "بنغازي، ليبيا", labelEn: "Benghazi, Libya", countryEn: "Libya", flag: "🇱🇾" },
  tripoli: { timezone: "Africa/Tripoli", labelAr: "Tripoli, Libya", labelEn: "Tripoli, Libya", countryEn: "Libya", flag: "🇱🇾" },
  السودان: { timezone: "Africa/Khartoum", labelAr: "الخرطوم، السودان", labelEn: "Khartoum, Sudan", countryEn: "Sudan", flag: "🇸🇩" },
  الخرطوم: { timezone: "Africa/Khartoum", labelAr: "الخرطوم، السودان", labelEn: "Khartoum, Sudan", countryEn: "Sudan", flag: "🇸🇩" },
  khartoum: { timezone: "Africa/Khartoum", labelAr: "Khartoum, Sudan", labelEn: "Khartoum, Sudan", countryEn: "Sudan", flag: "🇸🇩" },
  أكادير: { timezone: "Africa/Casablanca", labelAr: "أكادير، المغرب", labelEn: "Agadir, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  مكناس: { timezone: "Africa/Casablanca", labelAr: "مكناس، المغرب", labelEn: "Meknes, Morocco", countryEn: "Morocco", flag: "🇲🇦" },
  وجدة: { timezone: "Africa/Casablanca", labelAr: "وجدة، المغرب", labelEn: "Oujda, Morocco", countryEn: "Morocco", flag: "🇲🇦" },

  // Asia & Oceania
  اليابان: { timezone: "Asia/Tokyo", labelAr: "طوكيو، اليابان", labelEn: "Tokyo, Japan", countryEn: "Japan", flag: "🇯🇵" },
  japan: { timezone: "Asia/Tokyo", labelAr: "Tokyo, Japan", labelEn: "Tokyo, Japan", countryEn: "Japan", flag: "🇯🇵" },
  طوكيو: { timezone: "Asia/Tokyo", labelAr: "طوكيو، اليابان", labelEn: "Tokyo, Japan", countryEn: "Japan", flag: "🇯🇵" },
  tokyo: { timezone: "Asia/Tokyo", labelAr: "Tokyo, Japan", labelEn: "Tokyo, Japan", countryEn: "Japan", flag: "🇯🇵" },

  الصين: { timezone: "Asia/Shanghai", labelAr: "بكين، الصين", labelEn: "Beijing, China", countryEn: "China", flag: "🇨🇳" },
  china: { timezone: "Asia/Shanghai", labelAr: "Beijing, China", labelEn: "Beijing, China", countryEn: "China", flag: "🇨🇳" },
  بكين: { timezone: "Asia/Shanghai", labelAr: "بكين، الصين", labelEn: "Beijing, China", countryEn: "China", flag: "🇨🇳" },
  beijing: { timezone: "Asia/Shanghai", labelAr: "Beijing, China", labelEn: "Beijing, China", countryEn: "China", flag: "🇨🇳" },

  الهند: { timezone: "Asia/Kolkata", labelAr: "نيودلهي، الهند", labelEn: "New Delhi, India", countryEn: "India", flag: "🇮🇳" },
  "كوريا الجنوبية": { timezone: "Asia/Seoul", labelAr: "سيول، كوريا الجنوبية", labelEn: "Seoul, South Korea", countryEn: "South Korea", flag: "🇰🇷" },
  سيول: { timezone: "Asia/Seoul", labelAr: "سيول، كوريا الجنوبية", labelEn: "Seoul, South Korea", countryEn: "South Korea", flag: "🇰🇷" },
  سنغافورة: { timezone: "Asia/Singapore", labelAr: "سنغافورة", labelEn: "Singapore", countryEn: "Singapore", flag: "🇸🇬" },
  تركيا: { timezone: "Europe/Istanbul", labelAr: "إسطنبول، تركيا", labelEn: "Istanbul, Turkey", countryEn: "Turkey", flag: "🇹🇷" },
  إسطنبول: { timezone: "Europe/Istanbul", labelAr: "إسطنبول، تركيا", labelEn: "Istanbul, Turkey", countryEn: "Turkey", flag: "🇹🇷" },

  // Europe
  بريطانيا: { timezone: "Europe/London", labelAr: "لندن، المملكة المتحدة", labelEn: "London, UK", countryEn: "United Kingdom", flag: "🇬🇧" },
  "المملكة المتحدة": { timezone: "Europe/London", labelAr: "لندن، المملكة المتحدة", labelEn: "London, UK", countryEn: "United Kingdom", flag: "🇬🇧" },
  لندن: { timezone: "Europe/London", labelAr: "لندن، المملكة المتحدة", labelEn: "London, UK", countryEn: "United Kingdom", flag: "🇬🇧" },
  london: { timezone: "Europe/London", labelAr: "London, UK", labelEn: "London, UK", countryEn: "United Kingdom", flag: "🇬🇧" },

  فرنسا: { timezone: "Europe/Paris", labelAr: "باريس، فرنسا", labelEn: "Paris, France", countryEn: "France", flag: "🇫🇷" },
  باريس: { timezone: "Europe/Paris", labelAr: "باريس، فرنسا", labelEn: "Paris, France", countryEn: "France", flag: "🇫🇷" },
  paris: { timezone: "Europe/Paris", labelAr: "Paris, France", labelEn: "Paris, France", countryEn: "France", flag: "🇫🇷" },

  ألمانيا: { timezone: "Europe/Berlin", labelAr: "برلين، ألمانيا", labelEn: "Berlin, Germany", countryEn: "Germany", flag: "🇩🇪" },
  برلين: { timezone: "Europe/Berlin", labelAr: "برلين، ألمانيا", labelEn: "Berlin, Germany", countryEn: "Germany", flag: "🇩🇪" },

  إسبانيا: { timezone: "Europe/Madrid", labelAr: "مدريد، إسبانيا", labelEn: "Madrid, Spain", countryEn: "Spain", flag: "🇪🇸" },
  مدريد: { timezone: "Europe/Madrid", labelAr: "مدريد، إسبانيا", labelEn: "Madrid, Spain", countryEn: "Spain", flag: "🇪🇸" },

  إيطاليا: { timezone: "Europe/Rome", labelAr: "روما، إيطاليا", labelEn: "Rome, Italy", countryEn: "Italy", flag: "🇮🇹" },
  روما: { timezone: "Europe/Rome", labelAr: "روما، إيطاليا", labelEn: "Rome, Italy", countryEn: "Italy", flag: "🇮🇹" },

  روسيا: { timezone: "Europe/Moscow", labelAr: "موسكو، روسيا", labelEn: "Moscow, Russia", countryEn: "Russia", flag: "🇷🇺" },
  موسكو: { timezone: "Europe/Moscow", labelAr: "موسكو، روسيا", labelEn: "Moscow, Russia", countryEn: "Russia", flag: "🇷🇺" },

  // Americas
  نيويورك: { timezone: "America/New_York", labelAr: "نيويورك، أمريكا", labelEn: "New York, USA", countryEn: "United States", flag: "🇺🇸" },
  "new york": { timezone: "America/New_York", labelAr: "New York, USA", labelEn: "New York, USA", countryEn: "United States", flag: "🇺🇸" },
  "لوس أنجلوس": { timezone: "America/Los_Angeles", labelAr: "لوس أنجلوس، أمريكا", labelEn: "Los Angeles, USA", countryEn: "United States", flag: "🇺🇸" },
  "los angeles": { timezone: "America/Los_Angeles", labelAr: "Los Angeles, USA", labelEn: "Los Angeles, USA", countryEn: "United States", flag: "🇺🇸" },
  شيكاغو: { timezone: "America/Chicago", labelAr: "شيكاغو، أمريكا", labelEn: "Chicago, USA", countryEn: "United States", flag: "🇺🇸" },
  دنفر: { timezone: "America/Denver", labelAr: "دنفر، أمريكا", labelEn: "Denver, USA", countryEn: "United States", flag: "🇺🇸" },

  تورونتو: { timezone: "America/Toronto", labelAr: "تورونتو، كندا", labelEn: "Toronto, Canada", countryEn: "Canada", flag: "🇨🇦" },
  فانكوفر: { timezone: "America/Vancouver", labelAr: "فانكوفر، كندا", labelEn: "Vancouver, Canada", countryEn: "Canada", flag: "🇨🇦" },

  // Australia
  سيدني: { timezone: "Australia/Sydney", labelAr: "سيدني، أستراليا", labelEn: "Sydney, Australia", countryEn: "Australia", flag: "🇦🇺" },
  sydney: { timezone: "Australia/Sydney", labelAr: "Sydney, Australia", labelEn: "Sydney, Australia", countryEn: "Australia", flag: "🇦🇺" },
  ملبورن: { timezone: "Australia/Melbourne", labelAr: "ملبورن، أستراليا", labelEn: "Melbourne, Australia", countryEn: "Australia", flag: "🇦🇺" },
  بيرث: { timezone: "Australia/Perth", labelAr: "بيرث، أستراليا", labelEn: "Perth, Australia", countryEn: "Australia", flag: "🇦🇺" },
};

export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
}

export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMinutes);
  const hours = Math.floor(absMin / 60).toString().padStart(2, "0");
  const mins = (absMin % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${mins}`;
}

export function checkIsDST(now: Date, timeZone: string): boolean {
  try {
    const year = now.getFullYear();
    const jan = new Date(year, 0, 15);
    const jul = new Date(year, 6, 15);
    const janOffset = getTimeZoneOffsetMinutes(jan, timeZone);
    const julOffset = getTimeZoneOffsetMinutes(jul, timeZone);
    const currentOffset = getTimeZoneOffsetMinutes(now, timeZone);

    if (janOffset === julOffset) {
      return false;
    }

    const stdOffset = Math.min(janOffset, julOffset);
    const dstOffset = Math.max(janOffset, julOffset);

    return currentOffset === dstOffset && currentOffset !== stdOffset;
  } catch (e) {
    return false;
  }
}

export function resolveLocationToTimeZone(input: string): {
  isAmbiguous?: boolean;
  countryName?: string;
  questionPrompt?: string;
  suggestedCities?: { nameAr: string; nameEn: string; query: string }[];
  timezone?: string;
  labelAr?: string;
  labelEn?: string;
  countryEn?: string;
  flag?: string;
} {
  const cleanInput = input.trim().toLowerCase().replace(/^(في|عن|بـ|بمدينة|بدولة|في دولة|في مدينة)\s+/i, "");

  // Direct IANA string check
  if (isValidTimeZone(input.trim())) {
    const parts = input.trim().split("/");
    const city = parts[parts.length - 1].replace(/_/g, " ");
    return {
      timezone: input.trim(),
      labelAr: city,
      labelEn: city,
      countryEn: parts[0] || "Global",
      flag: "🌍",
    };
  }

  // Check mapped locations/cities
  for (const [key, val] of Object.entries(LOCATION_TIMEZONE_MAP)) {
    if (cleanInput.includes(key.toLowerCase()) || key.toLowerCase().includes(cleanInput)) {
      return {
        timezone: val.timezone,
        labelAr: val.labelAr,
        labelEn: val.labelEn,
        countryEn: val.countryEn,
        flag: val.flag,
      };
    }
  }

  // Check Ambiguous Multi-timezone Countries
  for (const [key, info] of Object.entries(AMBIGUOUS_COUNTRIES)) {
    if (cleanInput.includes(key.toLowerCase()) || key.toLowerCase().includes(cleanInput)) {
      return {
        isAmbiguous: true,
        countryName: info.ar,
        questionPrompt: info.citiesPromptAr,
        suggestedCities: info.suggestedCities,
      };
    }
  }

  // Default fallback
  return {
    timezone: "Africa/Casablanca",
    labelAr: "الرباط، المغرب",
    labelEn: "Rabat, Morocco",
    countryEn: "Morocco",
    flag: "🇲🇦",
  };
}

export function getCurrentTimeInfo(locationOrTz: string, refDate: Date = new Date()): TimeZoneResult {
  const resolved = resolveLocationToTimeZone(locationOrTz);

  if (resolved.isAmbiguous) {
    return {
      success: false,
      isAmbiguous: true,
      countryName: resolved.countryName,
      questionPrompt: resolved.questionPrompt,
      suggestedCities: resolved.suggestedCities,
      timezone: "AMBIGUOUS",
      localTime: "",
      localTimeShort: "",
      localDate: "",
      year: refDate.getFullYear(),
      monthShortAr: "",
      monthShortEn: "",
      dayOfMonth: refDate.getDate(),
      dayOfWeekAr: "",
      dayOfWeekEn: "",
      formattedDateAr: "",
      formattedDateEn: "",
      utcOffset: "",
      isDST: false,
      rawTimestamp: refDate.getTime(),
    };
  }

  const tz = resolved.timezone || "Africa/Casablanca";

  try {
    const offsetMin = getTimeZoneOffsetMinutes(refDate, tz);
    const utcOffset = formatUtcOffset(offsetMin);
    const isDST = checkIsDST(refDate, tz);

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const timeShortFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const dateIsoFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const dateArFormatter = new Intl.DateTimeFormat("ar-MA", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const weekdayArFormatter = new Intl.DateTimeFormat("ar-MA", {
      timeZone: tz,
      weekday: "long",
    });

    const monthArFormatter = new Intl.DateTimeFormat("ar-MA", {
      timeZone: tz,
      month: "short",
    });

    const monthEnFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
    });

    const dateEnFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const weekdayEnFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    });

    const dayNumberFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "numeric",
    });

    const yearNumberFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
    });

    const yearNum = parseInt(yearNumberFormatter.format(refDate), 10) || refDate.getFullYear();
    const dayNum = parseInt(dayNumberFormatter.format(refDate), 10) || refDate.getDate();

    return {
      success: true,
      timezone: tz,
      cityName: resolved.labelAr,
      cityEn: resolved.labelEn,
      countryEn: resolved.countryEn,
      flagEmoji: resolved.flag || "🌍",
      localTime: timeFormatter.format(refDate),
      localTimeShort: timeShortFormatter.format(refDate),
      localDate: dateIsoFormatter.format(refDate),
      year: yearNum,
      monthShortAr: monthArFormatter.format(refDate),
      monthShortEn: monthEnFormatter.format(refDate).toUpperCase(),
      dayOfMonth: dayNum,
      dayOfWeekAr: weekdayArFormatter.format(refDate),
      dayOfWeekEn: weekdayEnFormatter.format(refDate).toUpperCase(),
      formattedDateAr: dateArFormatter.format(refDate),
      formattedDateEn: dateEnFormatter.format(refDate),
      utcOffset,
      isDST,
      rawTimestamp: refDate.getTime(),
    };
  } catch (err) {
    console.warn("getCurrentTimeInfo Error:", tz, err);
    return {
      success: false,
      timezone: tz,
      cityName: resolved.labelAr || "الرباط، المغرب",
      cityEn: resolved.labelEn || "Rabat, Morocco",
      flagEmoji: "🇲🇦",
      localTime: "12:00:00",
      localTimeShort: "12:00",
      localDate: refDate.toISOString().slice(0, 10),
      year: refDate.getFullYear(),
      monthShortAr: "أغسطس",
      monthShortEn: "AUG",
      dayOfMonth: refDate.getDate(),
      dayOfWeekAr: "اليوم",
      dayOfWeekEn: "MON",
      formattedDateAr: "اليوم",
      formattedDateEn: "Today",
      utcOffset: "+00:00",
      isDST: false,
      rawTimestamp: refDate.getTime(),
    };
  }
}

export function convertTimeInfo(
  fromLocationOrTz: string,
  toLocationOrTz: string,
  dateTimeStr?: string
): ConvertTimeResult {
  const resolvedFrom = resolveLocationToTimeZone(fromLocationOrTz);
  const resolvedTo = resolveLocationToTimeZone(toLocationOrTz);

  const fromTz = resolvedFrom.timezone || "Africa/Casablanca";
  const toTz = resolvedTo.timezone || "Asia/Tokyo";

  const now = new Date();
  let baseDate = new Date();

  if (dateTimeStr && dateTimeStr.trim()) {
    const cleanStr = dateTimeStr.trim();
    const timeOnlyMatch = cleanStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnlyMatch) {
      const hours = parseInt(timeOnlyMatch[1], 10);
      const mins = parseInt(timeOnlyMatch[2], 10);
      const secs = timeOnlyMatch[3] ? parseInt(timeOnlyMatch[3], 10) : 0;

      const fromCurrent = getCurrentTimeInfo(fromTz, now);
      const [y, m, d] = fromCurrent.localDate.split("-").map(Number);

      const approxUtc = new Date(Date.UTC(y, m - 1, d, hours, mins, secs));
      const offsetMin = getTimeZoneOffsetMinutes(approxUtc, fromTz);
      baseDate = new Date(approxUtc.getTime() - offsetMin * 60000);
    } else {
      const parsed = new Date(cleanStr);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }
  }

  const fromInfo = getCurrentTimeInfo(fromTz, baseDate);
  const toInfo = getCurrentTimeInfo(toTz, baseDate);

  return {
    success: true,
    fromTimezone: fromTz,
    toTimezone: toTz,
    fromLocationLabel: resolvedFrom.labelAr || fromTz,
    toLocationLabel: resolvedTo.labelAr || toTz,
    fromFlag: resolvedFrom.flag || "🌍",
    toFlag: resolvedTo.flag || "🌍",
    originalTime: fromInfo.localTimeShort,
    convertedTime: toInfo.localTime,
    convertedTimeShort: toInfo.localTimeShort,
    convertedDate: toInfo.localDate,
    convertedFormattedAr: toInfo.formattedDateAr,
    convertedFormattedEn: toInfo.formattedDateEn,
    convertedDayOfWeekAr: toInfo.dayOfWeekAr,
    fromUtcOffset: fromInfo.utcOffset,
    toUtcOffset: toInfo.utcOffset,
    fromIsDST: fromInfo.isDST,
    toIsDST: toInfo.isDST,
  };
}
