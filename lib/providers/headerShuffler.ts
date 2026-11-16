/**
 * Natural Header & User-Agent Shuffler for SoufAI
 * Rotates outbound headers and client signatures to prevent server IP
 * fingerprinting and bot classification by AI providers and WAFs.
 */

const NATURAL_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:129.0) Gecko/20100101 Firefox/129.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
];

const ACCEPT_LANGUAGES = [
  "ar,en-US;q=0.9,en;q=0.8",
  "en-US,en;q=0.9,ar;q=0.8",
  "ar-SA,ar;q=0.9,en;q=0.8",
  "en-GB,en;q=0.9,ar;q=0.8",
  "fr-FR,fr;q=0.9,ar;q=0.8,en;q=0.7",
];

export class HeaderShuffler {
  private static currentIndex = 0;

  /**
   * Returns a rotated realistic User-Agent string
   */
  public static getRandomUserAgent(): string {
    const ua = NATURAL_USER_AGENTS[this.currentIndex % NATURAL_USER_AGENTS.length];
    this.currentIndex++;
    return ua;
  }

  /**
   * Generates natural HTTP headers for outbound API requests
   */
  public static getNaturalHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const langIndex = Math.floor(Math.random() * ACCEPT_LANGUAGES.length);

    return {
      "User-Agent": this.getRandomUserAgent(),
      "Accept-Language": ACCEPT_LANGUAGES[langIndex],
      "Accept": "application/json, text/plain, */*",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      ...customHeaders,
    };
  }
}
