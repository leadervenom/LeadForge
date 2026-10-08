export { cn } from "cn"

/** Gmail compose window in the browser's default Google account. */
export function gmailComposeUrl(to: string, subject?: string, body?: string) {
  const params = new URLSearchParams({ view: "cm", fs: "1", to });
  if (subject) params.set("su", subject);
  if (body) params.set("body", body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/** Google Maps search for the business; an exact match opens its Business Profile. */
export function googleProfileUrl(name: string, address?: string | null) {
  const query = address ? `${name}, ${address}` : name;
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
